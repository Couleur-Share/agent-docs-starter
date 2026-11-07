import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSkills, render, templateValues, validateSite } from "../scripts/lib/skills.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "install-skills.mjs");
const temp = mkdtempSync(path.join(os.tmpdir(), "agent-docs-starter-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const site = {
  slug: "design-docs",
  name: "设计文档站",
  scope: "品牌规范与设计系统",
  owner: "alice",
  triggers: ["新建或修改界面时需要确定配色、字体与间距", "制作品牌物料"],
  reviewDays: { Reference: 180, Playbook: 90 },
};
const siteFile = path.join(temp, "site.json");
writeFileSync(siteFile, JSON.stringify(site));

const cli = (...args) => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
};

test("site.json 里还有 TODO 时拒绝安装", () => {
  const todoFile = path.join(temp, "site-todo.json");
  writeFileSync(todoFile, JSON.stringify({ ...site, name: "TODO 站点名称" }));
  assert.match(validateSite(JSON.parse(readFileSync(todoFile, "utf8"))).join("\n"), /TODO/);
  const refused = cli("--dry-run", "--site", todoFile);
  assert.equal(refused.code, 1);
  assert.match(refused.err, /TODO/);
});

test("validateSite 检查 slug、必填字段、单行、owner 与复核期限", () => {
  assert.deepEqual(validateSite(site), []);
  assert.match(validateSite({ ...site, slug: "Design Docs" }).join(), /slug/);
  assert.match(validateSite({ ...site, triggers: [] }).join(), /triggers/);
  assert.match(validateSite({ ...site, scope: "两行\n内容" }).join(), /scope/);
  assert.match(validateSite({ ...site, owner: "human:alice" }).join(), /owner/);
  assert.match(validateSite({ ...site, reviewDays: { Reference: 0 } }).join(), /reviewDays/);
  assert.match(validateSite({ ...site, reviewDays: {} }).join(), /reviewDays/);
});

test("渲染结果填好路径、触发场景、owner 与复核期限，name 与目录名一致", () => {
  const skills = buildSkills(templateValues(site));
  assert.deepEqual(skills.map((skill) => skill.name).sort(), ["design-docs-lookup", "design-docs-writeback"]);
  for (const skill of skills) {
    assert.doesNotMatch(skill.content, /\{\{[A-Z_]+\}\}/);
    assert.match(skill.content, new RegExp(`^name: ${skill.name}$`, "m"));
    assert.ok(skill.content.includes(path.join("src", "content", "docs")));
  }
  assert.match(skills.find((skill) => skill.name.endsWith("lookup")).content, /^- 制作品牌物料$/m);
  const writeback = skills.find((skill) => skill.name.endsWith("writeback")).content;
  assert.match(writeback, /`human:alice`/);
  assert.match(writeback, /`Reference` 180 天、`Playbook` 90 天/);
  assert.ok(writeback.includes(path.join("scripts", "okf-stamp.mjs")));
  assert.throws(() => render("{{UNKNOWN}}", {}), /未知占位符/);
  assert.throws(() => buildSkills(templateValues({ ...site, triggers: ["很长的场景".repeat(250)] })), /description/);
});

test("安装、核对、发现改动与旧副本", () => {
  const home = path.join(temp, "home");
  mkdirSync(path.join(home, ".cursor"), { recursive: true });
  mkdirSync(path.join(home, ".codex"), { recursive: true });
  const common = ["--home", home, "--site", siteFile];

  assert.equal(cli("--dry-run", ...common).code, 0);
  assert.equal(existsSync(path.join(home, ".cursor", "skills")), false);

  const installed = cli(...common);
  assert.equal(installed.code, 0, installed.err);
  const lookup = path.join(home, ".cursor", "skills", "design-docs-lookup", "SKILL.md");
  assert.ok(existsSync(lookup));
  assert.ok(existsSync(path.join(home, ".codex", "skills", "design-docs-writeback", "SKILL.md")));
  assert.equal(cli("--check", ...common).code, 0);

  writeFileSync(lookup, "被手动改过");
  const changed = cli("--check", ...common);
  assert.equal(changed.code, 1);
  assert.match(changed.err, /与模板不一致/);
  assert.equal(cli(...common).code, 0);

  const renamed = path.join(home, ".cursor", "skills", "old-docs-lookup");
  mkdirSync(renamed, { recursive: true });
  writeFileSync(path.join(renamed, "SKILL.md"), readFileSync(lookup, "utf8"));
  const stale = cli("--check", ...common);
  assert.equal(stale.code, 1);
  assert.match(stale.err, /旧副本/);
});

test("Codex 全局规则写进 ~/.codex/AGENTS.md 的标记段落，保留原有内容并能核对", () => {
  const home = path.join(temp, "codex-home");
  const agents = path.join(home, ".codex", "AGENTS.md");
  mkdirSync(path.dirname(agents), { recursive: true });
  writeFileSync(agents, "# 我的 Codex 规则\r\n\r\n原有内容。\r\n");
  const common = ["--target", "codex", "--home", home, "--site", siteFile];

  assert.equal(cli(...common).code, 0);
  const first = readFileSync(agents, "utf8");
  assert.match(first, /^# 我的 Codex 规则\n\n原有内容。\n\n<!-- agent-docs-starter begin slug=design-docs repo=/);
  assert.match(first, /本机没有 design-docs-lookup 这个 Skill 时忽略本条。\n<!-- agent-docs-starter end slug=design-docs -->\n$/);
  assert.equal(cli("--check", ...common).code, 0);

  assert.equal(cli(...common).code, 0);
  assert.equal(readFileSync(agents, "utf8"), first);

  writeFileSync(agents, first.replace("先按 skill", "先按某个 skill"));
  const changed = cli("--check", ...common);
  assert.equal(changed.code, 1);
  assert.match(changed.err, /Codex 全局规则中的 design-docs 段落/);
  assert.equal(cli(...common).code, 0);
  assert.equal(readFileSync(agents, "utf8"), first);

  const repo = /repo=(.+?) -->/.exec(first)[1];
  writeFileSync(agents, `${first}\n<!-- agent-docs-starter begin slug=old-docs repo=${repo} -->\n旧规则\n<!-- agent-docs-starter end slug=old-docs -->\n`);
  const stale = cli("--check", ...common);
  assert.equal(stale.code, 1);
  assert.match(stale.err, /旧段落：Codex 全局规则中的 old-docs/);
});

test("--target 指定目标，--print 输出渲染结果", () => {
  const home = path.join(temp, "empty-home");
  mkdirSync(home, { recursive: true });
  assert.equal(cli("--dry-run", "--home", home, "--site", siteFile).code, 1);
  const forced = cli("--dry-run", "--target", "codex", "--home", home, "--site", siteFile);
  assert.equal(forced.code, 0);
  assert.match(forced.out, /\.codex/);
  assert.doesNotMatch(forced.out, /\.cursor/);
  const cursorOnly = cli("--dry-run", "--target", "cursor", "--home", home, "--site", siteFile);
  assert.equal(cursorOnly.code, 0);
  assert.doesNotMatch(cursorOnly.out, /AGENTS\.md/);

  const rule = cli("--print", "user-rule", "--site", siteFile);
  assert.equal(rule.code, 0);
  assert.equal(
    rule.out.trim(),
    "品牌规范与设计系统以「设计文档站」为唯一来源。任务涉及这些内容时，无论当前在哪个项目，先按 skill design-docs-lookup 查阅再动手；查不到就如实说明，不凭记忆补。做出改变这些内容的决定后，按 skill design-docs-writeback 写回。本机没有 design-docs-lookup 这个 Skill 时忽略本条。",
  );
  assert.doesNotMatch(rule.out, /[A-Za-z]:\\|\/content\/docs/);
  assert.equal(cli("--print", "nope", "--site", siteFile).code, 2);
});

test("渲染后的 Skill 带同步步骤：查阅前拉取，写回后拉取再推送", () => {
  const skills = buildSkills(templateValues(site));
  const lookup = skills.find((skill) => skill.name.endsWith("lookup")).content;
  const writeback = skills.find((skill) => skill.name.endsWith("writeback")).content;
  assert.match(lookup, /pull --ff-only --quiet/);
  assert.match(writeback, /pull --ff-only`/);
  assert.match(writeback, /pull --rebase\n.*push/);
});
