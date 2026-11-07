import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actorProblem, isoWithOffset, stampLines } from "../scripts/lib/stamp.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "okf-stamp.mjs");
const at = new Date("2026-11-07T05:46:35Z");

test("时间写成带时区偏移的 ISO 8601", () => {
  assert.equal(isoWithOffset(at, 480), "2026-11-07T13:46:35+08:00");
  assert.equal(isoWithOffset(at, -300), "2026-11-07T00:46:35-05:00");
  assert.equal(isoWithOffset(at, 0), "2026-11-07T05:46:35+00:00");
  assert.equal(Date.parse(isoWithOffset(at)), at.getTime());
});

test("verified 按页面类型推算 stale_after，没有期限时只输出 verified", () => {
  const reviewDays = { Reference: 180 };
  assert.deepEqual(stampLines({ kind: "verified", by: "human:alice", type: "Reference", at, reviewDays, offsetMinutes: 480 }), [
    "verified: { by: human:alice, at: 2026-11-07T13:46:35+08:00 }",
    "stale_after: 2027-05-06T13:46:35+08:00",
  ]);
  assert.equal(stampLines({ kind: "verified", by: "process:ci", type: "Overview", at, reviewDays }).length, 1);
  assert.equal(
    stampLines({ kind: "verified", by: "process:ci", type: "Overview", at, days: 1, offsetMinutes: 480 })[1],
    "stale_after: 2026-11-08T13:46:35+08:00",
  );
  assert.deepEqual(stampLines({ kind: "generated", by: "cursor-agent/model", at, offsetMinutes: 480 }), [
    "generated: { by: cursor-agent/model, at: 2026-11-07T13:46:35+08:00 }",
  ]);
});

test("作者与核验者遵循 OKF 的 actor 写法", () => {
  for (const actor of ["human:alice", "process:nightly", "cursor-agent/claude-opus-5.5"]) assert.equal(actorProblem(actor), null, actor);
  for (const actor of ["Human:alice", "human/alice", "alice", ""]) assert.ok(actorProblem(actor), actor);
  assert.throws(() => stampLines({ kind: "verified", by: "Human:alice", type: "Reference" }), /小写/);
});

test("命令行输出可以直接粘贴的行，期限读 agent-kit/site.json", () => {
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, TZ: "Asia/Shanghai" } });
  const verified = run("verified", "Reference", "--by", "human:alice", "--at", "2026-11-07T13:46:35+08:00");
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(verified.stdout.trim(), "verified: { by: human:alice, at: 2026-11-07T13:46:35+08:00 }\nstale_after: 2027-05-06T13:46:35+08:00");
  const overview = run("verified", "Overview", "--by", "process:ci");
  assert.equal(overview.status, 0);
  assert.match(overview.stderr, /没有复核期限/);
  assert.equal(run("verified", "Reference", "--by", "human:alice", "--days", "0").status, 2);
  assert.equal(run("verified", "Reference", "--by", "Human:alice").status, 2);
  assert.equal(run("verified").status, 2);
});
