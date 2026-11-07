#!/usr/bin/env node
// 检查全部页面的写法（规则见 scripts/lib/check.mjs），并扫描片段目录里的秘密。有错误时退出码为 1。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defaultDocsDir, listSourceFiles, loadPages } from "./lib/docs.mjs";
import { checkPages, secretErrors } from "./lib/check.mjs";

function main(argv) {
  const docsIndex = argv.indexOf("--docs");
  const docsDir = docsIndex === -1 ? defaultDocsDir : path.resolve(argv[docsIndex + 1] ?? "");
  if (!existsSync(docsDir)) {
    console.error(`文档源目录不存在：${docsDir}`);
    return 1;
  }
  const pages = loadPages(docsDir);
  const { errors, warnings } = checkPages(pages);
  const partialsDir = path.join(docsDir, "..", "partials");
  const partials = existsSync(partialsDir) ? listSourceFiles(partialsDir) : [];
  for (const file of partials) errors.push(...secretErrors(file, readFileSync(file, "utf8")));

  const where = (item) => `${path.relative(process.cwd(), item.file)}:${item.line}`;
  for (const item of warnings) console.warn(`提示  ${where(item)}  ${item.message}`);
  for (const item of errors) console.error(`错误  ${where(item)}  ${item.message}`);
  console.log(`检查了 ${pages.length} 个页面、${partials.length} 个片段：${errors.length} 个错误，${warnings.length} 条提示。`);
  return errors.length ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
