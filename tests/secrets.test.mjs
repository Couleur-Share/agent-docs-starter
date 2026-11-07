import { test } from "node:test";
import assert from "node:assert/strict";
import { scanSecrets } from "../scripts/lib/secrets.mjs";

// 令牌和私钥样例在运行时拼出来，仓库里不出现长得像真秘密的字面量。
const kinds = (text) => scanSecrets(text).map((item) => item.kind);

test("私钥块与常见令牌格式", () => {
  assert.deepEqual(kinds(`-----BEGIN ${"RSA PRIVATE"} KEY-----`), ["私钥"]);
  assert.deepEqual(kinds(`令牌 ${"ghp_"}${"a".repeat(36)}`), ["GitHub 令牌"]);
  assert.deepEqual(kinds(`${"AKIA"}IOSFODNN7EXAMPLE`), ["AWS 访问密钥"]);
  assert.deepEqual(kinds(`key: ${"sk-"}${"x1".repeat(12)}`), ["API 密钥"]);
  assert.deepEqual(kinds(`${"xoxb"}-123-456`), ["Slack 令牌"]);
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

test("每行最多报一次，放行标记跳过该行，行号从 1 开始", () => {
  const found = scanSecrets(["正文", 'password: "hunter2"', "password: hunter2 <!-- secret-scan:allow -->"].join("\r\n"));
  assert.deepEqual(found, [{ line: 2, kind: "凭据值" }]);
});
