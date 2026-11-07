// 渲染 agent-kit 里的 Skill 与用户规则模板，安装并核对本机副本。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultDocsDir, parsePage, repoRoot } from "./docs.mjs";

export const kitDir = path.join(repoRoot, "agent-kit");

// Agent Skills 规范：name 为小写字母、数字与连字符且不超过 64 字符，description 不超过 1024 字符。
// slug 最长 54，留给 "-writeback" 这类后缀。
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DESCRIPTION = 1024;

export function validateSite(site) {
  const problems = [];
  const line = (value) => typeof value === "string" && value.trim() !== "" && !/[\r\n]/.test(value);
  if (!SLUG.test(site?.slug ?? "") || site.slug.length > 54)
    problems.push("slug 只能用小写字母、数字和连字符，最长 54 个字符，例如 design-docs");
  if (!line(site?.name)) problems.push("name 要写成一行，不能为空");
  if (!line(site?.scope)) problems.push("scope 要写成一行，不能为空");
  if (!/^[A-Za-z0-9][\w.-]*$/.test(site?.owner ?? ""))
    problems.push("owner 写你的标识（字母、数字、点、下划线或连字符），核验时记为 human:<owner>");
  if (!Array.isArray(site?.triggers) || !site.triggers.length || !site.triggers.every(line))
    problems.push("triggers 至少写一条任务场景，每条一行");
  const days = Object.entries(site?.reviewDays ?? {});
  if (!days.length || !days.every(([type, value]) => type.trim() && Number.isInteger(value) && value > 0))
    problems.push("reviewDays 按页面类型写复核期限天数（正整数），例如 { \"Reference\": 180 }");
  if (JSON.stringify(site ?? {}).includes("TODO")) problems.push("还有 TODO 没有替换，先按 README 定制 agent-kit/site.json");
  return problems;
}

export function templateValues(site, { repo = repoRoot, docsDir = defaultDocsDir } = {}) {
  const command = (script) => `node "${path.join(repo, "scripts", script)}"`;
  const triggers = site.triggers.map((trigger) => trigger.trim());
  return {
    NAME: site.name.trim(),
    SLUG: site.slug,
    SCOPE: site.scope.trim(),
    OWNER: site.owner,
    TRIGGERS_INLINE: triggers.join("；"),
    TRIGGERS_LIST: triggers.map((trigger) => `- ${trigger}`).join("\n"),
    REVIEW_DAYS: Object.entries(site.reviewDays).map(([type, days]) => `\`${type}\` ${days} 天`).join("、"),
    REPO_DIR: repo,
    DOCS_DIR: docsDir,
    QUERY: command("docs-query.mjs"),
    CHECK: command("check-content.mjs"),
    STAMP: command("okf-stamp.mjs"),
    MARKER: `<!-- agent-docs-starter: ${repo} -->`,
  };
}

export function render(template, values) {
  return template.replace(/\r\n/g, "\n").replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`模板里有未知占位符 ${placeholder}`);
    return values[key];
  });
}

/** 渲染 agent-kit/skills/<名称>/SKILL.md，得到 [{ name: "<slug>-<名称>", content }]。 */
export function buildSkills(values, skillsDir = path.join(kitDir, "skills")) {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const name = `${values.SLUG}-${entry.name}`;
      const content = render(readFileSync(path.join(skillsDir, entry.name, "SKILL.md"), "utf8"), values);
      const { data } = parsePage("SKILL.md", content);
      if (data?.name !== name) throw new Error(`${entry.name}/SKILL.md 的 name 应为 ${name}，实际是 ${data?.name ?? "空"}`);
      const length = [...(data.description ?? "")].length;
      if (!length || length > MAX_DESCRIPTION)
        throw new Error(`${name} 的 description 有 ${length} 字，须在 1–${MAX_DESCRIPTION} 之间；缩短 scope 或 triggers`);
      return { name, content };
    });
}

/** 未指定目标时，只装到本机已存在的 ~/.cursor 与 ~/.codex。 */
export function targetDirs(home, targets) {
  const known = { cursor: path.join(home, ".cursor", "skills"), codex: path.join(home, ".codex", "skills") };
  const names = targets ?? Object.keys(known).filter((name) => existsSync(path.dirname(known[name])));
  for (const name of names) if (!known[name]) throw new Error(`未知的安装目标 ${name}，可选 cursor、codex`);
  return names.map((name) => ({ name, dir: known[name] }));
}

export function installSkills(skills, dirs, { dryRun = false } = {}) {
  const files = [];
  for (const { dir } of dirs) {
    for (const skill of skills) {
      const file = path.join(dir, skill.name, "SKILL.md");
      if (!dryRun) {
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, skill.content);
      }
      files.push(file);
    }
  }
  return files;
}

/** 核对已安装副本；带同一仓库标记、但不在当前清单里的 Skill 视为改名留下的旧副本。 */
export function checkSkills(skills, dirs, marker) {
  const problems = [];
  const expected = new Set(skills.map((skill) => skill.name));
  for (const { dir } of dirs) {
    for (const skill of skills) {
      const file = path.join(dir, skill.name, "SKILL.md");
      if (!existsSync(file)) problems.push(`缺少 ${file}`);
      else if (readFileSync(file, "utf8").replace(/\r\n/g, "\n") !== skill.content) problems.push(`与模板不一致：${file}`);
    }
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || expected.has(entry.name)) continue;
      const file = path.join(dir, entry.name, "SKILL.md");
      if (existsSync(file) && readFileSync(file, "utf8").includes(marker)) problems.push(`旧副本：${file}`);
    }
  }
  return problems;
}
