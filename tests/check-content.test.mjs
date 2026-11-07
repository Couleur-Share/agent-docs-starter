import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "../scripts/lib/docs.mjs";
import { checkPages, secretErrors } from "../scripts/lib/check.mjs";

const page = (rel, front, body = "正文。") => parsePage(rel, `---\n${front}\n---\n\n${body}\n`);
const valid = (rel, title, extra = "") => page(rel, `type: Reference\ntitle: ${title}\ndescription: 一句完整的说明。${extra}`);
const messages = (items) => items.map((item) => item.message).join("\n");

test("写法正确的页面没有错误和提示", () => {
  const { errors, warnings } = checkPages([
    page("index.mdx", "type: Overview\ntitle: 首页\ndescription: 首页。"),
    valid("guide/colors.md", "色彩", "\naliases: [配色]"),
    page("archive/old.md", "type: Reference\ntitle: 旧色彩\ndescription: 已被取代。\nstatus: deprecated\nsupersededBy: /guide/colors"),
    page("archive/index.mdx", "type: Overview\ntitle: 归档\ndescription: 归档。"),
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("摘要不是完整句子算错误；缺摘要留给 OKF 校验器", () => {
  const { errors } = checkPages([
    page("a.md", "type: Reference\ntitle: 冒号结尾\ndescription: 本页包括："),
    page("b.md", "type: Reference\ntitle: 没有摘要"),
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /完整的一句话/);
  assert.equal(errors[0].line, 4);
});

test("supersededBy 只用于 deprecated 页面，且要指向存在的 stable 页面", () => {
  const { errors } = checkPages([
    valid("current.md", "现行"),
    page("draft.md", "type: Reference\ntitle: 草稿\ndescription: 说明。\nstatus: draft"),
    page("unknown.md", "type: Reference\ntitle: 不存在\ndescription: 说明。\nstatus: deprecated\nsupersededBy: /nope/"),
    page("to-draft.md", "type: Reference\ntitle: 指向草稿\ndescription: 说明。\nstatus: deprecated\nsupersededBy: /draft/"),
    page("stray.md", "type: Reference\ntitle: 多余字段\ndescription: 说明。\nsupersededBy: /current/"),
    page("historic.md", "type: Reference\ntitle: 只是历史\ndescription: 说明。\nstatus: deprecated"),
  ]);
  const text = messages(errors);
  assert.equal(errors.length, 3);
  assert.match(text, /指向的页面不存在：\/nope\//);
  assert.match(text, /必须指向现行页面，draft\.md 的状态是 draft/);
  assert.match(text, /只有 status: deprecated 的页面才写 supersededBy/);
});

test("内容目录里不能用 OKF 保留的 index.md 和 log.md", () => {
  const { errors } = checkPages([
    valid("index.md", "首页"),
    valid("guide/log.md", "日志"),
    valid("guide/index.mdx", "分区"),
  ]);
  assert.equal(errors.length, 2);
  assert.match(messages(errors), /index\.md 是 OKF 保留的文件名/);
  assert.match(messages(errors), /log\.md 是 OKF 保留的文件名/);
});

test("一级标题算错误，代码块里的不算", () => {
  const { errors } = checkPages([page("a.md", "type: Reference\ntitle: 甲\ndescription: 说明。", "# 一级标题\n\n```sh\n# 注释\n```")]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 7);
});

test("页面和片段里疑似泄露的秘密算错误，放行标记可以排除误报", () => {
  const { errors } = checkPages([
    page("a.md", "type: Reference\ntitle: 甲\ndescription: 说明。", "数据库 password: hunter2\n\n仓库 password: <见密码库条目>"),
    page("b.md", "type: Reference\ntitle: 乙\ndescription: 说明。", "password: hunter2 <!-- secret-scan:allow -->"),
  ]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 7);
  assert.match(errors[0].message, /疑似泄露密码/);
  assert.deepEqual(
    secretErrors("partials/x.md", `-----BEGIN ${"OPENSSH PRIVATE"} KEY-----\n${"QUJD".repeat(12)}`).map((item) => [item.file, item.line]),
    [["partials/x.md", 1]],
  );
});

test("重复的标题或别名、长行、归档里的现行页面给出提示", () => {
  const long = "字".repeat(501);
  const { errors, warnings } = checkPages([
    valid("a.md", "色彩"),
    valid("b.md", "配色方案", "\naliases: [色彩]"),
    page("c.md", "type: Reference\ntitle: 长行\ndescription: 说明。", `${long}\n\n<div data-history>\n${long}\n</div>`),
    valid("archive/stale.md", "忘了改状态"),
  ]);
  assert.deepEqual(errors, []);
  const text = messages(warnings);
  assert.equal(warnings.filter((item) => /“色彩”同时是/.test(item.message)).length, 2);
  assert.equal(warnings.filter((item) => /单行 501 字/.test(item.message)).length, 1);
  assert.match(text, /archive\/ 下的页面应标为 status: deprecated/);
});
