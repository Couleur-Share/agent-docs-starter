import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSkills, kitDir, render, templateValues, validateSite } from "../scripts/lib/skills.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "install-skills.mjs");
const temp = mkdtempSync(path.join(os.tmpdir(), "agent-docs-starter-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const site = {
  slug: "design-docs",
  name: "设计文档站",
  scope: "品牌规范与设计系统",
  triggers: ["新建或修改界面时需要确定配色、字体与间距", "制作品牌物料"],
};
const siteFile = path.join(temp, "site.json");
writeFileSync(siteFile, JSON.stringify(site));

const cli = (...args) => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
};

test("模板自带的 site.json 还没定制，安装会被拒绝", () => {
  const template = JSON.parse(readFileSync(path.join(kitDir, "site.json"), "utf8"));
  assert.match(validateSite(template).join("\n"), /TODO/);
  const refused = cli("--dry-run");
  assert.equal(refused.code, 1);
  assert.match(refused.err, /TODO/);
});

test("validateSite 检查 slug、必填字段和单行", () => {
  assert.deepEqual(validateSite(site), []);
  assert.match(validateSite({ ...site, slug: "Design Docs" }).join(), /slug/);
  assert.match(validateSite({ ...site, triggers: [] }).join(), /triggers/);
  assert.match(validateSite({ ...site, scope: "两行\n内容" }).join(), /scope/);
});

test("渲染结果填好路径与触发场景，name 与目录名一致", () => {
  const skills = buildSkills(templateValues(site));
  assert.deepEqual(skills.map((skill) => skill.name).sort(), ["design-docs-lookup", "design-docs-writeback"]);
  for (const skill of skills) {
    assert.doesNotMatch(skill.content, /\{\{|\}\}/);
    assert.match(skill.content, new RegExp(`^name: ${skill.name}$`, "m"));
    assert.ok(skill.content.includes(path.join("src", "content", "docs")));
  }
  assert.match(skills.find((skill) => skill.name.endsWith("lookup")).content, /^- 制作品牌物料$/m);
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

test("--target 指定目标，--print 输出渲染结果", () => {
  const home = path.join(temp, "empty-home");
  mkdirSync(home, { recursive: true });
  assert.equal(cli("--dry-run", "--home", home, "--site", siteFile).code, 1);
  const forced = cli("--dry-run", "--target", "codex", "--home", home, "--site", siteFile);
  assert.equal(forced.code, 0);
  assert.match(forced.out, /\.codex/);
  assert.doesNotMatch(forced.out, /\.cursor/);

  const rule = cli("--print", "user-rule", "--site", siteFile);
  assert.equal(rule.code, 0);
  assert.match(rule.out, /^品牌规范与设计系统以「设计文档站」为唯一来源/);
  assert.match(rule.out, /本机没有上述目录时忽略本条。/);
  assert.equal(cli("--print", "nope", "--site", siteFile).code, 2);
});
