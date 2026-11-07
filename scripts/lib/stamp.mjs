// 生成 OKF v0.2 的时间字段：带时区偏移的 ISO 8601 时间（§5），verified 附带按复核期限推算的 stale_after。
const DAY = 86_400_000;

// §7 的三种写法：human:<id>、process:<id>、<producer>/<version>。
// §5.3 只认小写的 human: 前缀，Human:dana 会被当成工具而降低信任等级，所以单独拦下。
const ACTOR = /^(?:human:\S+|process:\S+|[^\s:/]+\/\S+)$/;
const NEAR_MISS = /^(?:human|process)(?![A-Za-z0-9_])/i;

export function actorProblem(actor) {
  if (typeof actor !== "string" || !actor) return "缺少 --by";
  if (NEAR_MISS.test(actor) && !/^(?:human|process):/.test(actor)) return "human: 和 process: 前缀要小写并紧跟冒号";
  if (!ACTOR.test(actor)) return "要写成 human:<标识>、process:<名称> 或 <工具>/<版本>";
  return null;
}

/** 本地时间加时区偏移，例如 2026-11-07T13:45:00+08:00；offsetMinutes 缺省取该时刻本机的偏移。 */
export function isoWithOffset(date, offsetMinutes = -date.getTimezoneOffset()) {
  const local = new Date(date.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 19);
  const abs = Math.abs(offsetMinutes);
  const offset = `${offsetMinutes < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${local}${offset}`;
}

/**
 * 返回可以直接写进页面头的行。verified 需要页面类型：days 缺省时取 reviewDays[type]，
 * 两者都没有就不写 stale_after（例如 Overview 页面）。
 */
export function stampLines({ kind, by, type, at = new Date(), days, reviewDays = {}, offsetMinutes }) {
  const problem = actorProblem(by);
  if (problem) throw new Error(`--by ${by ?? ""}：${problem}`);
  if (Number.isNaN(at.getTime())) throw new Error("--at 不是有效的时间");
  const format = (date) => isoWithOffset(date, offsetMinutes ?? -date.getTimezoneOffset());
  if (kind === "generated") return [`generated: { by: ${by}, at: ${format(at)} }`];
  if (kind !== "verified") throw new Error(`未知的字段 ${kind}，可选 verified 或 generated`);
  const period = days ?? reviewDays[type];
  const lines = [`verified: { by: ${by}, at: ${format(at)} }`];
  if (period) lines.push(`stale_after: ${format(new Date(at.getTime() + period * DAY))}`);
  return lines;
}
