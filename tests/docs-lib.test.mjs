import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPages, headings, loadPages, parsePage, resolvePage, routeOf, sections } from "../scripts/lib/docs.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "docs");

test("routeOf 处理 index、嵌套路径、大小写与空格", () => {
  assert.equal(routeOf("index.md"), "/");
  assert.equal(routeOf("guide/index.mdx"), "/guide/");
  assert.equal(routeOf("guide/reindex.md"), "/guide/reindex/");
  assert.equal(routeOf("Brand/Logo Usage.md"), "/brand/logo-usage/");
});

test("页面头支持引号、折叠块、两种列表、行尾注释与嵌套对象", () => {
  const page = parsePage(
    "a.md",
    [
      "---",
      "title: '色彩 ''规范'''",
      "description: >-",
      "  第一行",
      "  第二行",
      'aliases: [配色, "palette, main"]',
      "status: superseded # 写在行尾的注释",
      "supersededBy: /guide/colors/",
      "reviewed: 2026-10-01",
      "sidebar:",
      "  order: 1",
      "---",
      "正文",
    ].join("\r\n"),
  );
  assert.equal(page.title, "色彩 '规范'");
  assert.equal(page.description, "第一行 第二行");
  assert.deepEqual(page.aliases, ["配色", "palette, main"]);
  assert.equal(page.status, "superseded");
  assert.equal(page.supersededBy, "/guide/colors/");
  assert.equal(page.reviewed, "2026-10-01");
  assert.deepEqual(page.data.sidebar, {});
  assert.equal(page.keyLines.reviewed, 9);

  const list = parsePage("b.md", ["---", "title: t", "aliases:", "  - 甲", "- 乙", "---"].join("\n"));
  assert.deepEqual(list.aliases, ["甲", "乙"]);
  assert.equal(parsePage("c.md", "没有页面头").data, null);
});

test("代码块与历史区里的标题不算章节，章节范围到下一个同级标题为止", () => {
  const [colors] = loadPages(fixtures).filter((page) => page.rel === "guide/colors.md");
  assert.deepEqual(
    headings(colors).map((heading) => `${heading.level}:${heading.title}`),
    ["2:主色", "3:主色用法", "2:辅助色", "2:变更记录"],
  );
  const main = sections(colors).find((section) => section.title === "主色");
  assert.equal(main.start, 10);
  assert.equal(main.end, 21);
  const history = sections(colors).find((section) => section.title === "变更记录");
  assert.ok(history.historyChars > 0 && history.historyChars < history.chars);
});

test("正文里用行内代码提到 data-history 不会开启历史区", () => {
  const page = parsePage(
    "d.md",
    ["---", "title: t", "---", "## 写法", "用 `<div data-history>` 包住旧内容。", "## 写回", "步骤。"].join("\n"),
  );
  assert.deepEqual(headings(page).map((heading) => heading.title), ["写法", "写回"]);
  assert.equal(page.lines.some((line) => line.history), false);
});

test("resolvePage 接受相对路径、路由、标题、别名和绝对路径", () => {
  const pages = loadPages(fixtures);
  const one = (query) => resolvePage(pages, query, fixtures).map((page) => page.rel);
  assert.deepEqual(one("guide/colors.md"), ["guide/colors.md"]);
  assert.deepEqual(one("guide\\colors"), ["guide/colors.md"]);
  assert.deepEqual(one("/guide/colors/"), ["guide/colors.md"]);
  assert.deepEqual(one("/"), ["index.md"]);
  assert.deepEqual(one("色彩规范"), ["guide/colors.md"]);
  assert.deepEqual(one("老配色"), ["archive/old-colors.md"]);
  assert.deepEqual(one(path.join(fixtures, "guide", "colors.md")), ["guide/colors.md"]);
  assert.deepEqual(one("不存在"), []);
});

test("findPages 要求每个词都命中，现行页面排在已取代页面前面", () => {
  const pages = loadPages(fixtures);
  const rels = (...terms) => findPages(pages, terms).map(({ page }) => page.rel);
  assert.deepEqual(rels("配色"), ["guide/colors.md", "archive/old-colors.md"]);
  assert.deepEqual(rels("配色", "辅助"), ["guide/colors.md"]);
  assert.deepEqual(rels("PALETTE"), ["guide/colors.md"]);
  assert.deepEqual(rels(), []);
});
