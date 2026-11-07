#!/usr/bin/env node
// 按需查询文档源：找页面、列页面、看章节、取一节。只读，不改文件。
import { existsSync } from "node:fs";
import path from "node:path";
import { defaultDocsDir, findPages, loadPages, resolvePage, sections, countChars } from "./lib/docs.mjs";

const USAGE = `用法：
  node scripts/docs-query.mjs find <关键词...>        按标题、别名、摘要、路径找页面，多个词须同时命中
  node scripts/docs-query.mjs list                    列出全部页面与摘要
  node scripts/docs-query.mjs outline <页面>          列出章节、行号与字数
  node scripts/docs-query.mjs section <页面> <章节>   只输出一节，默认省略 data-history 历史区
选项：
  --history       section 同时输出历史区
  --docs <目录>   文档源目录，默认为本仓库的 src/content/docs
<页面> 可写源文件相对路径、站内路由、页面标题或别名。`;

function label(page) {
  const parts = [];
  if (page.status === "superseded") parts.push(`已被取代 → ${page.supersededBy}`);
  else if (page.status === "historical") parts.push("历史");
  if (page.reviewed) parts.push(`核实于 ${page.reviewed}`);
  return parts.length ? `  [${parts.join("，")}]` : "";
}

function printPage(page) {
  console.log(`${page.route}  ${page.title}${label(page)}`);
  if (page.description) console.log(`  ${page.description}`);
  console.log(`  ${page.file}`);
}

function pickPage(pages, query, docsDir) {
  const found = resolvePage(pages, query, docsDir);
  if (found.length === 1) return found[0];
  if (!found.length) console.error(`找不到页面：${query}。先用 find 查一下。`);
  else console.error(`“${query}”对应多个页面，请写源文件路径：\n${found.map((page) => `  ${page.rel}`).join("\n")}`);
  return null;
}

function outline(page) {
  const all = sections(page);
  const historyChars = countChars(page.lines.filter((line) => line.history));
  console.log(`${page.rel}  共 ${page.totalLines} 行、${countChars(page.lines)} 字，其中历史记录 ${historyChars} 字`);
  if (!all.length) console.log("  （没有章节标题）");
  for (const section of all) {
    const indent = "  ".repeat(Math.max(0, section.level - 2));
    const history = section.historyChars ? `（历史 ${section.historyChars} 字）` : "";
    console.log(`${indent}L${section.start}–${section.end}  ${"#".repeat(section.level)} ${section.title}  ${section.chars} 字${history}`);
  }
}

function section(page, query, withHistory) {
  const all = sections(page);
  const lower = query.trim().toLowerCase();
  const exact = all.filter((item) => item.title.toLowerCase() === lower);
  const found = exact.length ? exact : all.filter((item) => item.title.toLowerCase().includes(lower));
  if (found.length !== 1) {
    if (!found.length) console.error(`${page.rel} 里没有章节“${query}”。用 outline 看全部章节。`);
    else console.error(`“${query}”对应多个章节：\n${found.map((item) => `  L${item.start} ${item.title}`).join("\n")}`);
    return found.length ? 2 : 1;
  }
  const [target] = found;
  console.log(`${page.rel}  L${target.start}–${target.end}`);
  let skipped = [];
  const flush = () => {
    if (skipped.length) console.log(`（省略历史记录 ${countChars(skipped)} 字，加 --history 查看）`);
    skipped = [];
  };
  for (const line of target.lines) {
    if (line.history && !withHistory) {
      skipped.push(line);
      continue;
    }
    flush();
    console.log(line.text);
  }
  flush();
  return 0;
}

function main(argv) {
  let docsDir = defaultDocsDir;
  let withHistory = false;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--history") withHistory = true;
    else if (argv[i] === "--docs" && argv[i + 1]) docsDir = path.resolve(argv[++i]);
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(USAGE);
      return 0;
    } else rest.push(argv[i]);
  }
  const [command, ...args] = rest;
  if (!existsSync(docsDir)) {
    console.error(`文档源目录不存在：${docsDir}`);
    return 1;
  }
  const pages = loadPages(docsDir);

  if (command === "list" && !args.length) {
    pages.forEach(printPage);
    return 0;
  }
  if (command === "find" && args.length) {
    const results = findPages(pages, args);
    if (!results.length) {
      console.error(`没有页面的标题、别名、摘要或路径同时包含：${args.join("、")}。可以在 ${docsDir} 里按关键词搜正文。`);
      return 1;
    }
    results.slice(0, 20).forEach(({ page }) => printPage(page));
    if (results.length > 20) console.log(`……另有 ${results.length - 20} 个页面，加关键词缩小范围。`);
    return 0;
  }
  if (command === "outline" && args.length === 1) {
    const page = pickPage(pages, args[0], docsDir);
    if (!page) return 1;
    outline(page);
    return 0;
  }
  if (command === "section" && args.length === 2) {
    const page = pickPage(pages, args[0], docsDir);
    return page ? section(page, args[1], withHistory) : 1;
  }
  console.error(USAGE);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
