import { test } from "node:test";
import assert from "node:assert/strict";
import { scanSecrets } from "../scripts/lib/secrets.mjs";

// 令牌和私钥样例在运行时拼出来，仓库里不出现长得像真秘密的字面量。
const kinds = (text) => scanSecrets(text).map((item) => item.kind);

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const HEX = "0123456789abcdef";
const B64 = `${ALNUM}+/`;
const URLSAFE = `${ALNUM}-_`;
/** 确定性的伪随机串，代替真实令牌。 */
function rand(n, seed, alphabet = ALNUM) {
  let x = seed >>> 0;
  let out = "";
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out += alphabet[(x >>> 16) % alphabet.length];
  }
  return out;
}
const join = (...parts) => parts.join("");

test("私钥块与常见令牌格式", () => {
  assert.deepEqual(kinds([`-----BEGIN ${"RSA PRIVATE"} KEY-----`, rand(64, 1, B64)].join("\n")), ["私钥"]);
  assert.deepEqual(kinds(`令牌 ${"ghp_"}${rand(36, 2)}`), ["GitHub 令牌"]);
  assert.deepEqual(kinds(join("AK", "IA", rand(16, 3, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"))), ["AWS 访问密钥"]);
  assert.deepEqual(kinds(`key: ${"sk-"}${"x1".repeat(12)}`), ["API 密钥"]);
  assert.deepEqual(kinds(`${"xoxb"}-123-456`), ["Slack 令牌"]);
});

test("私钥正文的几种写法：多行、JSON 里的 \\n 转义、PGP 头字段之后", () => {
  assert.deepEqual(kinds(join('{"private_key": "-----BEGIN ', 'PRIVATE KEY-----\\n', rand(64, 4, B64), '\\n"}')), ["私钥"]);
  assert.deepEqual(
    kinds([join("-----BEGIN PGP ", "PRIVATE KEY BLOCK-----"), "Version: GnuPG v2", "", rand(64, 5, B64)].join("\n")),
    ["私钥"],
  );
  assert.deepEqual(kinds(join("PuTTY-User-", "Key-File-3: ssh-ed25519")), ["PuTTY 私钥"]);
});

test("其他常见令牌、URL 与请求头里的凭据", () => {
  for (const [text, kind] of [
    [join('"key": "AI', "za", rand(35, 6, URLSAFE), '"'), "Google API 密钥"],
    [join("cf", "ut_", rand(40, 7), rand(8, 8, HEX)), "Cloudflare 令牌"],
    [join("https://api.telegram.org/bot", "7123456789", ":AA", rand(33, 9, URLSAFE), "/sendMessage"), "Telegram 机器人令牌"],
    [join("ey", "J", rand(30, 10, URLSAFE), ".eyJ", rand(60, 11, URLSAFE), ".", rand(43, 12, URLSAFE)), "JWT"],
    [join("git clone https://deploy:", "hunter2", "@git.internal.lan/ops.git"), "URL 内嵌密码"],
    [join('curl -H "Authorization: Bearer ', rand(39, 13), '6"'), "请求头凭据"],
    [join("CF_API_TOKEN=", rand(39, 14), "2"), "凭据值"],
    [join("api_key: ", rand(32, 15, HEX)), "凭据值"],
  ]) {
    assert.deepEqual(kinds(text), [kind], kind);
  }
});

test("凭据词后紧跟具体值", () => {
  assert.deepEqual(kinds("password: hunter2"), ["密码"]);
  assert.deepEqual(kinds("Password `s3cr3t!`"), ["凭据值"]);
  assert.deepEqual(kinds("api key = 'abcd1234'"), ["凭据值"]);
  assert.deepEqual(kinds('{"api_token": "abcd1234"}'), ["凭据值"]);
});

test("占位符、变量、路径与中文说明不算泄露", () => {
  for (const line of [
    "password: <在密码库里>",
    "password: ${DB_PASSWORD}",
    "password: DB_PASSWORD",
    "password: ~/.secrets/db",
    "password: ***",
    "password: 见密码库条目「数据库」",
    "token: `<token>`",
    "passwordless 登录",
    "不写密钥、口令、Token 和授权码",
  ]) {
    assert.deepEqual(kinds(line), [], line);
  }
});

test("普通词、示例令牌、说明文字和代码表达式不算泄露", () => {
  for (const line of [
    "startup-task-disabled-for-windows-login",
    "whisk-config-2026-11-07-backup-plan",
    "sk-internationalization-configuration",
    join("私钥文件以 `-----BEGIN ", "OPENSSH PRIVATE KEY-----` 开头"),
    [join("-----BEGIN ", "OPENSSH PRIVATE KEY-----"), "...（正文省略）"].join("\n"),
    join("AK", "IA", "IOSFODNN7EXAMPLE"),
    join("gh", "p_", "X".repeat(36)),
    join("cf", "ut_", "x".repeat(48)),
    "https://api.telegram.org/bot<TOKEN>/sendMessage",
    "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    "https://user:<password>@git.internal.lan",
    "redis://:${REDIS_PASSWORD}@redis:6379",
    "postgres://app:password@db.internal:5432/app",
    join("https://user:", "hunter2", "@example.com/"),
    "Authorization: Bearer <token>",
    "Authorization: Bearer $API_TOKEN",
    "用 Bearer token 认证，见 Basic authentication",
    "token: 见团队密码库",
    "secret: my-app-secret",
    "max_tokens: 4096",
    "$password = Read-Host -AsSecureString",
    "$securePassword = Read-VaultMasterSecret",
    'password = os.environ["DB_PASSWORD"]',
    "api_key = load_key2fa(path)",
    '"integrity": "sha512-Q2xhc3NpY0J1aWxkSGFzaE5vdEFTZWNyZXQ0MjQyNDI0Mg=="',
  ]) {
    assert.deepEqual(kinds(line), [], line);
  }
});

test("每行最多报一次，放行标记跳过该行，行号从 1 开始", () => {
  const found = scanSecrets(["正文", 'password: "hunter2"', "password: hunter2 <!-- secret-scan:allow -->"].join("\r\n"));
  assert.deepEqual(found, [{ line: 2, kind: "凭据值" }]);
});
