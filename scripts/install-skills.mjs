#!/usr/bin/env node
// 按 agent-kit/site.json 渲染 Skill 模板，安装到本机 Cursor 与 Codex 的个人 Skill 目录，或核对已装副本。
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildSkills,
  checkSkills,
  installSkills,
  kitDir,
  render,
  targetDirs,
  templateValues,
  validateSite,
} from "./lib/skills.mjs";

const USAGE = `用法：
  node scripts/install-skills.mjs                 安装到本机已有的 ~/.cursor 与 ~/.codex
  node scripts/install-skills.mjs --check         核对已安装的副本与模板一致
  node scripts/install-skills.mjs --dry-run       只显示会写到哪里
  node scripts/install-skills.mjs --print <名称>  输出渲染结果：lookup、writeback 或 user-rule
选项：
  --target cursor,codex   指定安装目标
  --home <目录>           代替用户主目录（测试用）
  --site <文件>           代替 agent-kit/site.json（测试用）`;

function main(argv) {
  const option = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  const siteFile = path.resolve(option("--site") ?? path.join(kitDir, "site.json"));
  const site = JSON.parse(readFileSync(siteFile, "utf8"));
  const problems = validateSite(site);
  if (problems.length) {
    console.error(`${siteFile} 需要先修改：\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    return 1;
  }
  const values = templateValues(site);
  const skills = buildSkills(values);

  const printName = option("--print");
  if (printName === "user-rule") {
    process.stdout.write(render(readFileSync(path.join(kitDir, "user-rule.md"), "utf8"), values));
    return 0;
  }
  if (printName) {
    const skill = skills.find((item) => item.name === `${site.slug}-${printName}`);
    if (!skill) {
      const names = skills.map((item) => item.name.slice(site.slug.length + 1));
      console.error(`没有名为 ${printName} 的模板，可选：${[...names, "user-rule"].join("、")}`);
      return 2;
    }
    process.stdout.write(skill.content);
    return 0;
  }

  const target = option("--target");
  const home = path.resolve(option("--home") ?? os.homedir());
  const dirs = targetDirs(home, target ? target.split(",").map((name) => name.trim()).filter(Boolean) : undefined);
  if (!dirs.length) {
    console.error("本机没有 ~/.cursor 或 ~/.codex；用 --target 指定安装目标。");
    return 1;
  }

  if (argv.includes("--check")) {
    const issues = checkSkills(skills, dirs, values.MARKER);
    if (issues.length) {
      console.error(issues.join("\n"));
      console.error("运行 node scripts/install-skills.mjs 重新安装；旧副本确认不再使用后手动删除。");
      return 1;
    }
    console.log(`已核对 ${dirs.map(({ dir }) => dir).join("、")}：${skills.map(({ name }) => name).join("、")} 与模板一致。`);
    return 0;
  }

  const dryRun = argv.includes("--dry-run");
  for (const file of installSkills(skills, dirs, { dryRun })) console.log(`${dryRun ? "将写入" : "已写入"} ${file}`);
  if (!dryRun) console.log("新开一个对话后生效；运行 --check 核对。");
  return 0;
}

process.exitCode = main(process.argv.slice(2));
