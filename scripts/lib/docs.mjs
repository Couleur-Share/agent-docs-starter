// 读文档源：列页面、解析页面头、按行标注代码块与历史区、拆章节。
// 只用 Node 内置模块：查询与检查脚本要能在没装依赖的电脑上、从别的项目里直接运行。
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const defaultDocsDir = path.join(repoRoot, "src", "content", "docs");
export const STATUSES = ["current", "historical", "superseded"];

const PAGE_EXT = /\.mdx?$/;

/** 递归列出 .md / .mdx 源文件；以 _ 或 . 开头的文件和目录不算页面。 */
export function listSourceFiles(docsDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (PAGE_EXT.test(entry.name)) files.push(full);
    }
  };
  walk(docsDir);
  return files.sort();
}

/** 源文件相对路径对应的站内路由：guide/index.md → /guide/，与 Astro 一样转小写、空格变连字符。 */
export function routeOf(rel) {
  const stem = rel
    .replace(PAGE_EXT, "")
    .replace(/(^|\/)index$/, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
  return stem ? `/${stem}/` : "/";
}

export function normalizeRoute(route) {
  const stem = route.trim().replace(/^\/+|\/+$/g, "");
  return stem ? `/${stem}/` : "/";
}

function splitFrontmatter(text) {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  const end = lines[0].trim() === "---" ? lines.findIndex((line, i) => i > 0 && line.trim() === "---") : -1;
  if (end === -1) return { yaml: null, bodyLines: lines, bodyStart: 1 };
  return { yaml: lines.slice(1, end), bodyLines: lines.slice(end + 1), bodyStart: end + 2 };
}

/**
 * 只解析页面头的顶层键：标量、引号字符串、>- / | 块、[a, b] 与逐行 - a 列表。
 * 嵌套对象（如 sidebar）记为 {}，查询和检查用不到它们的内容。
 */
function parseFrontmatter(yamlLines) {
  const data = {};
  const keyLines = {};
  for (let i = 0; i < yamlLines.length; i++) {
    const match = /^([A-Za-z_][\w-]*):(\s.*)?$/.exec(yamlLines[i]);
    if (!match) continue;
    keyLines[match[1]] = i + 2;
    const block = [];
    while (i + 1 < yamlLines.length && /^(\s|-\s|-$|$)/.test(yamlLines[i + 1])) block.push(yamlLines[++i]);
    data[match[1]] = parseValue((match[2] ?? "").trim(), block);
  }
  return { data, keyLines };
}

function parseValue(raw, block) {
  const value = /^["']/.test(raw) ? raw : raw.replace(/\s#.*$/, "").trim();
  if (/^[|>][+-]?$/.test(value)) return blockScalar(value[0], block);
  if (value.startsWith("[")) return flowList([value, ...block.map((line) => line.trim())].join(" "));
  if (value === "") {
    const items = block.flatMap((line) => /^\s*-\s+(.*)$/.exec(line)?.[1] ?? []);
    if (items.length) return items.map((item) => scalar(item.replace(/\s#.*$/, "").trim()));
    return block.some((line) => line.trim()) ? {} : null;
  }
  const rest = block.map((line) => line.trim()).filter(Boolean);
  return scalar(rest.length && !/^["']/.test(value) ? [value, ...rest].join(" ") : value);
}

function scalar(value) {
  if (value.startsWith("'")) {
    const match = /^'((?:[^']|'')*)'/.exec(value);
    return match ? match[1].replaceAll("''", "'") : value;
  }
  if (value.startsWith('"')) {
    const match = /^"((?:[^"\\]|\\.)*)"/.exec(value);
    if (!match) return value;
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return match[1];
    }
  }
  if (value === "" || value === "null" || value === "~") return null;
  if (value === "true" || value === "false") return value === "true";
  return value;
}

function blockScalar(style, block) {
  const lines = block.map((line) => line.trimEnd());
  while (lines.length && !lines.at(-1)) lines.pop();
  const indent = Math.min(...lines.filter(Boolean).map((line) => line.length - line.trimStart().length));
  const body = lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0));
  if (style === "|") return body.join("\n");
  return body.reduce((out, line, i) => (line ? out + (i > 0 && body[i - 1] ? " " : "") + line : `${out}\n`), "");
}

function flowList(text) {
  const close = text.lastIndexOf("]");
  const inner = text.slice(text.indexOf("[") + 1, close === -1 ? undefined : close);
  const items = [];
  let current = "";
  let quote = "";
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === ",") {
      items.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  items.push(current);
  return items.map((item) => scalar(item.trim())).filter((item) => item !== null && item !== "");
}

const asText = (value) => (value == null || typeof value === "object" ? "" : String(value).trim());
const asList = (value) => (Array.isArray(value) ? value.map(asText).filter(Boolean) : asText(value) ? [asText(value)] : []);
// 行内代码里提到的标签不算数；历史区按 Markdown 的 HTML 块规则，必须从行首（最多缩进 3 格）开始。
const withoutCodeSpans = (text) => text.replace(/(`+)[^`]*?\1/g, "");
const divDelta = (text) => {
  const html = withoutCodeSpans(text);
  return (html.match(/<div\b/g) ?? []).length - (html.match(/<\/div>/g) ?? []).length;
};
const opensHistory = (text) => /^ {0,3}<div\b[^>]*\bdata-history\b/.test(text);

/** 逐行标注正文：是否在代码块里，是否在 <div data-history> 历史区里；line 是源文件行号。 */
function annotate(bodyLines, bodyStart) {
  let fence = null;
  let depth = 0;
  return bodyLines.map((text, i) => {
    const line = bodyStart + i;
    const trimmed = text.trim();
    const marker = /^(`{3,}|~{3,})/.exec(trimmed)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && trimmed === marker) fence = null;
      return { text, line, code: true, history: depth > 0 };
    }
    if (marker) {
      fence = marker;
      return { text, line, code: true, history: depth > 0 };
    }
    let history = depth > 0;
    if (depth > 0) {
      depth = Math.max(0, depth + divDelta(text));
    } else if (opensHistory(text)) {
      history = true;
      depth = Math.max(0, divDelta(text));
    }
    return { text, line, code: false, history };
  });
}

/** 从源文本构造页面对象；rel 是相对文档源目录、用 / 分隔的路径。 */
export function parsePage(rel, text) {
  const { yaml, bodyLines, bodyStart } = splitFrontmatter(text);
  const { data, keyLines } = yaml ? parseFrontmatter(yaml) : { data: null, keyLines: {} };
  const slug = typeof data?.slug === "string" ? data.slug : null;
  return {
    rel,
    route: slug === null ? routeOf(rel) : normalizeRoute(slug),
    data,
    keyLines,
    title: asText(data?.title),
    description: asText(data?.description),
    aliases: asList(data?.aliases),
    status: asText(data?.status) || "current",
    supersededBy: asText(data?.supersededBy),
    reviewed: asText(data?.reviewed),
    totalLines: bodyStart - 1 + bodyLines.length,
    lines: annotate(bodyLines, bodyStart),
  };
}

export function loadPages(docsDir = defaultDocsDir) {
  return listSourceFiles(docsDir).map((file) => ({
    ...parsePage(path.relative(docsDir, file).split(path.sep).join("/"), readFileSync(file, "utf8")),
    file,
  }));
}

/** 非空白字符数，中英文统一按字计。 */
export const countChars = (lines) => lines.reduce((n, line) => n + [...line.text.replace(/\s/g, "")].length, 0);

/** 正文里代码块与历史区之外的 ATX 标题。 */
export function headings(page) {
  return page.lines.flatMap((line) => {
    if (line.code || line.history) return [];
    const match = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line.text);
    if (!match || !match[2]) return [];
    return [{ level: match[1].length, title: match[2].replace(/\s*\{#[^}]*\}$/, "").trim(), line: line.line }];
  });
}

/** 每个标题的范围到下一个同级或更高级标题之前，附总字数与其中历史区字数。 */
export function sections(page) {
  const all = headings(page);
  return all.map((heading, i) => {
    const next = all.slice(i + 1).find((other) => other.level <= heading.level);
    const lines = page.lines.filter((line) => line.line >= heading.line && (!next || line.line < next.line));
    while (lines.length > 1 && !lines.at(-1).text.trim()) lines.pop();
    return {
      ...heading,
      start: heading.line,
      end: lines.at(-1).line,
      chars: countChars(lines),
      historyChars: countChars(lines.filter((line) => line.history)),
      lines,
    };
  });
}

/** 按源文件路径、站内路由、标题或别名定位页面；可能返回多个候选。 */
export function resolvePage(pages, query, docsDir = defaultDocsDir) {
  const absolute = path.resolve(query);
  const insideDocs = absolute.toLowerCase().startsWith((docsDir + path.sep).toLowerCase());
  const raw = insideDocs ? path.relative(docsDir, absolute).split(path.sep).join("/") : query.trim().replace(/\\/g, "/");
  const stem = raw.replace(/^\.?\/+/, "").replace(/\/+$/, "").replace(PAGE_EXT, "");
  const byPath = pages.filter((page) => {
    const pageStem = page.rel.replace(PAGE_EXT, "");
    return pageStem === stem || pageStem === `${stem}/index` || page.route === normalizeRoute(stem);
  });
  if (byPath.length) return byPath;
  const lower = raw.toLowerCase();
  return pages.filter(
    (page) => page.title.toLowerCase() === lower || page.aliases.some((alias) => alias.toLowerCase() === lower),
  );
}

/** 每个关键词都要命中标题、别名、摘要或路径之一；按命中位置打分，非现行页面排后。 */
export function findPages(pages, keywords) {
  const terms = keywords.map((term) => term.trim().toLowerCase()).filter(Boolean);
  if (!terms.length) return [];
  return pages
    .map((page) => {
      const title = page.title.toLowerCase();
      const aliases = page.aliases.map((alias) => alias.toLowerCase());
      const description = page.description.toLowerCase();
      const where = `${page.rel.toLowerCase()} ${page.route}`;
      let score = 0;
      for (const term of terms) {
        const hit =
          (title.includes(term) ? 4 : 0) +
          (aliases.some((alias) => alias.includes(term)) ? 3 : 0) +
          (description.includes(term) ? 2 : 0) +
          (where.includes(term) ? 1 : 0);
        if (!hit) return null;
        score += hit;
      }
      return { page, score: page.status === "current" ? score : score - 1 };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.page.rel.localeCompare(b.page.rel));
}
