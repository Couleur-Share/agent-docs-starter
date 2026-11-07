// 页面写法检查，只管 OKF v0.2 校验器不管的部分：一句话摘要、正文一级标题、长行、取代链、
// 保留文件名、重名和泄露秘密。type、时间格式、信任字段等 OKF 合规由 CI 里的 OKF 校验器负责。
import { RESERVED_FILENAMES, normalizeRoute } from "./docs.mjs";
import { scanSecrets } from "./secrets.mjs";

const MAX_LINE = 500;

const secretMessage = (kind) =>
  `疑似泄露${kind}：删掉具体值，只写存放位置；确认是误报，就在同一行加 secret-scan:allow`;

/** 扫描任意文件里的秘密，返回与 checkPages 相同格式的错误。 */
export function secretErrors(file, text) {
  return scanSecrets(text).map(({ line, kind }) => ({ file, line, message: secretMessage(kind) }));
}

/** 返回 { errors, warnings }，每条含 file、line、message。错误应阻断，提示只供参考。 */
export function checkPages(pages) {
  const errors = [];
  const warnings = [];
  const byRoute = new Map(pages.map((page) => [page.route, page]));
  const report = (list, page, key, message) =>
    list.push({ file: page.file ?? page.rel, line: typeof key === "number" ? key : (page.keyLines[key] ?? 1), message });

  for (const page of pages) {
    const name = page.rel.split("/").at(-1);
    if (RESERVED_FILENAMES.includes(name))
      report(errors, page, 1, `${name} 是 OKF 保留的文件名，不能写普通页面；首页和分区首页用 index.mdx`);
    errors.push(...secretErrors(page.file ?? page.rel, page.source));
    if (!page.data) continue;

    if (/[：:，,、；;]$/.test(page.description))
      report(errors, page, "description", "description 要写成完整的一句话，不要以冒号、逗号或分号结尾");

    if (page.supersededBy) {
      const target = byRoute.get(normalizeRoute(page.supersededBy));
      if (page.status !== "deprecated")
        report(errors, page, "supersededBy", "只有 status: deprecated 的页面才写 supersededBy");
      else if (!target) report(errors, page, "supersededBy", `supersededBy 指向的页面不存在：${page.supersededBy}`);
      else if (target.status !== "stable")
        report(errors, page, "supersededBy", `supersededBy 必须指向现行页面，${target.rel} 的状态是 ${target.status}`);
    }
    if (page.rel.startsWith("archive/") && page.route !== "/archive/" && page.status !== "deprecated")
      report(warnings, page, "status", "archive/ 下的页面应标为 status: deprecated");

    for (const line of page.lines) {
      if (line.code) continue;
      if (/^#\s/.test(line.text)) report(errors, page, line.line, "正文不要写一级标题，页面标题来自 title");
      const length = [...line.text].length;
      if (!line.history && length > MAX_LINE)
        report(warnings, page, line.line, `单行 ${length} 字，超过 ${MAX_LINE}；拆成短句或列表，长行容易被搜索工具截断`);
    }
  }

  const owners = new Map();
  const claim = (name, page, key) => {
    const lower = name.toLowerCase();
    if (!owners.has(lower)) owners.set(lower, []);
    owners.get(lower).push({ page, key, name });
  };
  for (const page of pages) {
    if (page.title) claim(page.title, page, "title");
    for (const alias of new Set(page.aliases)) claim(alias, page, "aliases");
  }
  for (const claims of owners.values()) {
    const distinct = new Set(claims.map(({ page }) => page.rel));
    if (distinct.size < 2) continue;
    for (const { page, key, name } of claims) {
      const others = [...distinct].filter((rel) => rel !== page.rel).join("、");
      report(warnings, page, key, `“${name}”同时是 ${others} 的标题或别名，按名字找页面时会混淆`);
    }
  }
  return { errors, warnings };
}
