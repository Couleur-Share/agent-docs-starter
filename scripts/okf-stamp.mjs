#!/usr/bin/env node
// 输出要写进页面头的 OKF 时间字段，不改任何文件。复核期限读 agent-kit/site.json 的 reviewDays。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib/docs.mjs";
import { stampLines } from "./lib/stamp.mjs";

const USAGE = `用法：
  node scripts/okf-stamp.mjs verified <页面类型> --by <核验者>   输出 verified，以及按复核期限推算的 stale_after
  node scripts/okf-stamp.mjs generated --by <作者>               输出 generated
选项：
  --days <天数>   覆盖该类型的复核期限
  --at <时间>     使用指定时间（ISO 8601，带时区偏移），缺省为现在
<核验者> 与 <作者> 写成 human:<标识>、process:<名称> 或 <工具>/<版本>。`;

function main(argv) {
  const option = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  const positional = argv.filter((arg, i) => !arg.startsWith("--") && !["--by", "--days", "--at"].includes(argv[i - 1]));
  const [kind, type] = positional;
  if (argv.includes("--help") || argv.includes("-h") || !kind || (kind === "verified" && !type)) {
    console.log(USAGE);
    return kind ? 2 : 0;
  }

  const siteFile = path.join(repoRoot, "agent-kit", "site.json");
  const reviewDays = existsSync(siteFile) ? (JSON.parse(readFileSync(siteFile, "utf8")).reviewDays ?? {}) : {};
  const daysText = option("--days");
  const days = daysText === undefined ? undefined : Number(daysText);
  if (days !== undefined && !(Number.isInteger(days) && days > 0)) {
    console.error("--days 要写成正整数");
    return 2;
  }
  const atText = option("--at");
  try {
    const lines = stampLines({ kind, by: option("--by"), type, days, reviewDays, at: atText ? new Date(atText) : new Date() });
    console.log(lines.join("\n"));
    if (kind === "verified" && lines.length === 1)
      console.error(`类型 ${type} 在 agent-kit/site.json 的 reviewDays 里没有复核期限，未生成 stale_after。`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
