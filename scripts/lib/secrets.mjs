// 泄露秘密扫描：私钥块、常见令牌格式，以及凭据词后紧跟具体值的写法。
// 规则改写自 dotinfra 的 lint（https://github.com/PiotrTopa/dotinfra ，MIT），另把含中文的值视为说明文字。
// 这是兜底，不能识别所有凭据格式。误报时在同一行加上 secret-scan:allow
// （.md 写在 <!-- --> 注释里，.mdx 写在 {/* */} 里）。

export const ALLOW_MARKER = "secret-scan:allow";

const PATTERNS = [
  ["私钥", /-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----/],
  ["age 私钥", /AGE-SECRET-KEY-1[0-9A-Z]{50,}/],
  ["AWS 访问密钥", /AKIA[0-9A-Z]{16}/],
  ["GitHub 令牌", /gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}/],
  ["API 密钥", /sk-[A-Za-z0-9_-]{20,}/],
  ["Slack 令牌", /xox[baprs]-/],
];

// 强凭据词后面可以直接跟值；pass、pin、token 这类弱词也是日常用词，必须有 :、=、is 或 set to 隔开。
// \x60 是反引号。凭据词不能是更长单词或名字的一部分（passwordless、grafana_password）。
const STRONG = String.raw`pass(?:word|wd|phrase)|pwd`;
const WEAK = String.raw`pass|pin|token|secret|api[ _-]?key`;
const SEPARATOR = String.raw`\s*\**\s*(?:[:=]|\bis\b|\bset\s+to\b)\s*\**\s*`;
const QUOTED = String.raw`(?:\x60([^\x60\n]{1,200})\x60|"([^"\n]{1,200})"|'([^'\n]{1,200})')`;
const NOTATIONS = [
  new RegExp(
    String.raw`(?<![\w\x60"'])(?:(?:${STRONG})\b(?:${SEPARATOR}|(?:\s*\*\*)?\s+)|(?:${WEAK})\b${SEPARATOR})${QUOTED}`,
    "gi",
  ),
  new RegExp(String.raw`["'][\w-]*(?:${STRONG}|${WEAK})["']\s*[:=]\s*${QUOTED}`, "gi"),
];
const ASSIGNMENT = /password\s*[:=]\s*(\S+)/gi;

// 指向别处而不是秘密本身的值：占位符（<password>、***、{{ var }}）、路径、变量名和中文说明。
const REFERENCE_PREFIXES = ["<", "{{", "$", "%", "~", "/", "./", "../"];
function isReference(raw) {
  const value = raw.trim().replace(/^["'\x60]+|["'\x60,;。，；]+$/g, "");
  return (
    value === "" ||
    /^[*.xX•…_-]+$/.test(value) ||
    /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value) ||
    REFERENCE_PREFIXES.some((prefix) => value.startsWith(prefix)) ||
    /[\u3400-\u9fff\uf900-\ufaff]/.test(value)
  );
}

function detect(line) {
  for (const [kind, pattern] of PATTERNS) if (pattern.test(line)) return kind;
  for (const pattern of NOTATIONS) {
    for (const match of line.matchAll(pattern)) {
      if (!isReference(match[1] ?? match[2] ?? match[3] ?? "")) return "凭据值";
    }
  }
  for (const match of line.matchAll(ASSIGNMENT)) if (!isReference(match[1])) return "密码";
  return null;
}

/** 逐行扫描整份文本（含页面头和代码块），每行最多报一次；返回 [{ line, kind }]。 */
export function scanSecrets(text) {
  return text.split(/\r?\n/).flatMap((line, i) => {
    if (line.includes(ALLOW_MARKER)) return [];
    const kind = detect(line);
    return kind ? [{ line: i + 1, kind }] : [];
  });
}
