import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "../scripts/lib/docs.mjs";
import { checkPages } from "../scripts/lib/check.mjs";

const page = (rel, front, body = "正文。") => parsePage(rel, `---\n${front}\n---\n\n${body}\n`);
const valid = (rel, title, extra = "") => page(rel, `title: ${title}\ndescription: 一句完整的说明。${extra}`);
const run = (...pages) => checkPages(pages, { today: "2026-11-07" });
const messages = (items) => items.map((item) => item.message).join("\n");

test("写法正确的页面没有错误和提示", () => {
  const { errors, warnings } = run(
    valid("index.md", "首页"),
    valid("guide/colors.md", "色彩", "\naliases: [配色]\nreviewed: 2026-11-07"),
    page("archive/old.md", "title: 旧色彩\ndescription: 已被取代。\nstatus: superseded\nsupersededBy: /guide/colors"),
    valid("archive/index.md", "归档"),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("缺页面头、标题或摘要，摘要不是完整句子，都算错误", () => {
  const { errors } = run(
    parsePage("a.md", "没有页面头"),
    page("b.md", "description: 说明。"),
    page("c.md", "title: 无摘要"),
    page("d.md", "title: 冒号结尾\ndescription: 本页包括："),
  );
  const text = messages(errors);
  assert.match(text, /缺少页面头/);
  assert.match(text, /缺少 title/);
  assert.match(text, /缺少 description/);
  assert.match(text, /完整的一句话/);
  assert.equal(errors.find((item) => /完整的一句话/.test(item.message)).line, 3);
});

test("状态与取代链", () => {
  const { errors } = run(
    valid("current.md", "现行"),
    page("bad-status.md", "title: 草稿\ndescription: 说明。\nstatus: draft"),
    page("no-target.md", "title: 无目标\ndescription: 说明。\nstatus: superseded"),
    page("unknown.md", "title: 指向不存在\ndescription: 说明。\nstatus: superseded\nsupersededBy: /nope/"),
    page("chain.md", "title: 指向历史\ndescription: 说明。\nstatus: superseded\nsupersededBy: /unknown/"),
    page("stray.md", "title: 多余字段\ndescription: 说明。\nsupersededBy: /current/"),
  );
  const text = messages(errors);
  assert.match(text, /status 只能是/);
  assert.match(text, /必须写 supersededBy/);
  assert.match(text, /指向的页面不存在：\/nope\//);
  assert.match(text, /必须指向现行页面，unknown\.md 的状态是 superseded/);
  assert.match(text, /只有 status 为 superseded 的页面才写 supersededBy/);
});

test("reviewed 必须是真实日期且不晚于今天", () => {
  const { errors } = run(
    valid("a.md", "甲", "\nreviewed: 2026-13-01"),
    valid("b.md", "乙", "\nreviewed: 2026-12-01"),
    valid("c.md", "丙", "\nreviewed: '2026-11-07'"),
  );
  assert.equal(errors.length, 2);
  assert.match(messages(errors), /YYYY-MM-DD：2026-13-01/);
  assert.match(messages(errors), /不能晚于今天（2026-11-07）/);
});

test("一级标题算错误，代码块里的不算", () => {
  const { errors } = run(
    page("a.md", "title: 甲\ndescription: 说明。", "# 一级标题\n\n```sh\n# 注释\n```"),
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 6);
});

test("重复的标题或别名、长行、归档里的现行页面给出提示", () => {
  const long = "字".repeat(501);
  const { errors, warnings } = run(
    valid("a.md", "色彩"),
    valid("b.md", "配色方案", "\naliases: [色彩]"),
    page("c.md", "title: 长行\ndescription: 说明。", `${long}\n\n<div data-history>\n${long}\n</div>`),
    valid("archive/stale.md", "忘了改状态"),
  );
  assert.deepEqual(errors, []);
  const text = messages(warnings);
  assert.equal(warnings.filter((item) => /“色彩”同时是/.test(item.message)).length, 2);
  assert.equal(warnings.filter((item) => /单行 501 字/.test(item.message)).length, 1);
  assert.match(text, /archive\/ 下的页面应标为 historical 或 superseded/);
});
