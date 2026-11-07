// 页面写法检查：页面头字段、取代链、核实日期、一级标题、重复标题与长行。
import { STATUSES, normalizeRoute } from "./docs.mjs";

const MAX_LINE = 500;

export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/** 返回 { errors, warnings }，每条含 file、line、message。错误应阻断，提示只供参考。 */
export function checkPages(pages, { today = localDate() } = {}) {
  const errors = [];
  const warnings = [];
  const byRoute = new Map(pages.map((page) => [page.route, page]));
  const report = (list, page, key, message) =>
    list.push({ file: page.file ?? page.rel, line: typeof key === "number" ? key : (page.keyLines[key] ?? 1), message });

  for (const page of pages) {
    if (!page.data) {
      report(errors, page, 1, "缺少页面头：文件开头要有 --- 包围的 YAML");
      continue;
    }
    if (!page.title) report(errors, page, "title", "缺少 title");
    if (!page.description) report(errors, page, "description", "缺少 description：用一句完整的话说明本页回答什么问题");
    else if (/[：:，,、；;]$/.test(page.description))
      report(errors, page, "description", "description 要写成完整的一句话，不要以冒号、逗号或分号结尾");

    if (!STATUSES.includes(page.status)) report(errors, page, "status", `status 只能是 ${STATUSES.join(" / ")}`);
    if (page.status === "superseded") {
      const target = page.supersededBy && byRoute.get(normalizeRoute(page.supersededBy));
      if (!page.supersededBy) report(errors, page, "status", "status 为 superseded 时必须写 supersededBy，指向取代它的页面");
      else if (!target) report(errors, page, "supersededBy", `supersededBy 指向的页面不存在：${page.supersededBy}`);
      else if (target.status !== "current")
        report(errors, page, "supersededBy", `supersededBy 必须指向现行页面，${target.rel} 的状态是 ${target.status}`);
    } else if (page.supersededBy) {
      report(errors, page, "supersededBy", "只有 status 为 superseded 的页面才写 supersededBy");
    }
    if (page.reviewed && !isDate(page.reviewed)) report(errors, page, "reviewed", `reviewed 要写成 YYYY-MM-DD：${page.reviewed}`);
    else if (page.reviewed > today) report(errors, page, "reviewed", `reviewed 不能晚于今天（${today}）`);

    if (page.rel.startsWith("archive/") && page.route !== "/archive/" && page.status === "current")
      report(warnings, page, "status", "archive/ 下的页面应标为 historical 或 superseded");

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
