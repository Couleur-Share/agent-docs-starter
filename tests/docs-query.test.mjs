import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "..", "scripts", "docs-query.mjs");
const fixtures = path.join(here, "fixtures", "docs");

const query = (...args) => {
  const result = spawnSync(process.execPath, [script, ...args, "--docs", fixtures], { encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
};

test("find 输出路由、标题、核实日期与源文件路径，找不到时退出码为 1", () => {
  const found = query("find", "配色");
  assert.equal(found.code, 0);
  const lines = found.out.trim().split(/\r?\n/);
  assert.match(lines[0], /^\/guide\/colors\/  色彩规范  \[核实于 2026-10-01\]$/);
  assert.match(found.out, /\[已被取代 → \/guide\/colors\/\]/);
  assert.ok(found.out.includes(path.join(fixtures, "guide", "colors.md")));
  assert.equal(query("find", "不存在的词").code, 1);
});

test("list 列出全部页面", () => {
  const listed = query("list");
  assert.equal(listed.code, 0);
  assert.equal(listed.out.match(/^\/\S*  /gm).length, 3);
});

test("outline 列出章节行号、字数和历史字数", () => {
  const outline = query("outline", "guide/colors.md");
  assert.equal(outline.code, 0);
  assert.match(outline.out, /^guide\/colors\.md  共 36 行/);
  assert.match(outline.out, /^L10–21  ## 主色  \d+ 字$/m);
  assert.match(outline.out, /^  L19–21  ### 主色用法/m);
  assert.match(outline.out, /## 变更记录  \d+ 字（历史 \d+ 字）/);
});

test("section 默认省略历史区，加 --history 才输出", () => {
  const brief = query("section", "/guide/colors/", "变更记录");
  assert.equal(brief.code, 0);
  assert.match(brief.out, /（省略历史记录 \d+ 字，加 --history 查看）/);
  assert.doesNotMatch(brief.out, /旧主色/);
  assert.match(query("section", "/guide/colors/", "变更记录", "--history").out, /旧主色是 #0F9D58。/);
});

test("section 精确匹配优先，包含下级章节；有歧义时退出码为 2", () => {
  const main = query("section", "色彩规范", "主色");
  assert.equal(main.code, 0);
  assert.match(main.out, /### 主色用法/);
  assert.doesNotMatch(main.out, /辅助色为/);
  assert.equal(query("section", "色彩规范", "色").code, 2);
  assert.equal(query("section", "色彩规范", "不存在").code, 1);
});

test("页面写法有误时给出提示", () => {
  assert.equal(query("outline", "没有这页").code, 1);
  assert.equal(query("unknown").code, 2);
});
