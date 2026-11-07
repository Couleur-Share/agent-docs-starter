import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPages, headings, isStale, loadPages, parsePage, resolvePage, routeOf, sections } from "../scripts/lib/docs.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "docs");
const byRel = (rel) => loadPages(fixtures).find((page) => page.rel === rel);

test("routeOf 处理 index、嵌套路径、大小写与空格", () => {
  assert.equal(routeOf("index.mdx"), "/");
  assert.equal(routeOf("guide/index.mdx"), "/guide/");
  assert.equal(routeOf("guide/reindex.md"), "/guide/reindex/");
  assert.equal(routeOf("Brand/Logo Usage.md"), "/brand/logo-usage/");
});

test("页面头支持引号、折叠块、两种列表、行尾注释与嵌套对象", () => {
  const page = parsePage(
    "a.md",
    [
      "---",
      "type: Reference",
      "title: '色彩 ''规范'''",
      "description: >-",
      "  第一行",
      "  第二行",
      'aliases: [配色, "palette, main"]',
      "tags: [品牌]",
      "status: deprecated # 写在行尾的注释",
      "supersededBy: /guide/colors/",
      "stale_after: 2026-10-01T10:00:00+08:00",
      "sidebar:",
      "  order: 1",
      "---",
      "正文",
    ].join("\r\n"),
  );
  assert.equal(page.type, "Reference");
  assert.equal(page.title, "色彩 '规范'");
  assert.equal(page.description, "第一行 第二行");
  assert.deepEqual(page.aliases, ["配色", "palette, main"]);
  assert.deepEqual(page.tags, ["品牌"]);
  assert.equal(page.status, "deprecated");
  assert.equal(page.supersededBy, "/guide/colors/");
  assert.equal(page.staleAfter, "2026-10-01T10:00:00+08:00");
  assert.deepEqual(page.data.sidebar, {});
  assert.equal(page.keyLines.stale_after, 11);

  const list = parsePage("b.md", ["---", "type: t", "aliases:", "  - 甲", "- 乙", "---"].join("\n"));
  assert.deepEqual(list.aliases, ["甲", "乙"]);
  assert.equal(list.status, "stable");
  assert.equal(parsePage("c.md", "没有页面头").data, null);
});

test("信任等级按 OKF：没有 verified 为未核验，有 human: 为人工核验，否则为机器核验", () => {
  assert.equal(byRel("guide/colors.md").trust, "human");
  assert.equal(byRel("guide/spacing.md").trust, "machine");
  assert.equal(byRel("archive/old-colors.md").trust, "unverified");
  const nearMiss = parsePage("d.md", "---\ntype: t\nverified: { by: Human:dana, at: 2026-11-01T00:00:00Z }\n---\n");
  assert.equal(nearMiss.trust, "machine");
});

test("stale_after 已过即为过期，缺省或无法解析不算过期", () => {
  const now = Date.parse("2026-11-07T00:00:00Z");
  assert.equal(isStale(byRel("guide/colors.md"), now), true);
  assert.equal(isStale(byRel("guide/spacing.md"), now), false);
  assert.equal(isStale(byRel("archive/old-colors.md"), now), false);
  assert.equal(isStale(parsePage("e.md", "---\nstale_after: 不是时间\n---\n"), now), false);
});

test("代码块与历史区里的标题不算章节，章节范围到下一个同级标题为止", () => {
  const colors = byRel("guide/colors.md");
  assert.deepEqual(
    headings(colors).map((heading) => `${heading.level}:${heading.title}`),
    ["2:主色", "3:主色用法", "2:辅助色", "2:变更记录"],
  );
  const main = sections(colors).find((section) => section.title === "主色");
  assert.equal(main.start, 16);
  assert.equal(main.end, 27);
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
  assert.deepEqual(one("/"), ["index.mdx"]);
  assert.deepEqual(one("色彩规范"), ["guide/colors.md"]);
  assert.deepEqual(one("老配色"), ["archive/old-colors.md"]);
  assert.deepEqual(one(path.join(fixtures, "guide", "colors.md")), ["guide/colors.md"]);
  assert.deepEqual(one("不存在"), []);
});

test("findPages 要求每个词都命中，标签也算，stable 页面排在已弃用页面前面", () => {
  const pages = loadPages(fixtures);
  const rels = (...terms) => findPages(pages, terms).map(({ page }) => page.rel);
  assert.deepEqual(rels("配色"), ["guide/colors.md", "archive/old-colors.md"]);
  assert.deepEqual(rels("配色", "辅助"), ["guide/colors.md"]);
  assert.deepEqual(rels("PALETTE"), ["guide/colors.md"]);
  assert.deepEqual(rels("间距"), ["guide/spacing.md"]);
  assert.deepEqual(rels("品牌"), ["guide/colors.md", "guide/spacing.md", "archive/old-colors.md"]);
  assert.deepEqual(rels(), []);
});
