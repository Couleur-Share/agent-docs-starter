// 泄露秘密扫描：私钥块、常见令牌格式、URL 与请求头里的凭据，以及凭据词后紧跟具体值的写法。
// 规则改写自 dotinfra 的 lint（https://github.com/PiotrTopa/dotinfra ，MIT），另把含中文的值视为说明文字。
// 这是兜底，不能识别所有凭据格式。误报时在同一行加上 secret-scan:allow
// （.md 写在 <!-- --> 注释里，.mdx 写在 {/* */} 里）。

export const ALLOW_MARKER = "secret-scan:allow";

// 一段够长且同时含字母和数字，才像机器生成的值。
const randomPart = (part, min = 8) => part.length >= min && /\d/.test(part) && /[a-z]/i.test(part);
const looksRandom = (value) =>
  /^[\x21-\x7e]{8,512}$/.test(value) &&
  !/^[a-z][a-z0-9+.-]*:\/\//i.test(value) &&
  value.split(/[-_.:/+=@,]+/).some((part) => randomPart(part));

// 文档里的示例令牌：同一字符连着 8 个以上、连着 4 个以上 x，或写着 example。
const looksFake = (token) => /(.)\1{7,}|x{4,}|example/i.test(token);

// 令牌前后不能紧挨字母或数字，所以 startup-task-… 这类普通词里的 sk- 不算。
const TOKENS = [
  ["age 私钥", /AGE-SECRET-KEY-1[0-9A-Z]{50,}/g],
  ["AWS 访问密钥", /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])/g],
  ["GitHub 令牌", /(?<![A-Za-z0-9_])(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g],
  [
    "API 密钥",
    /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g,
    (token) => token.slice(3).split(/[-_]+/).some((part) => randomPart(part, 20)),
  ],
  ["Google API 密钥", /(?<![A-Za-z0-9_-])AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g],
  ["Cloudflare 令牌", /(?<![A-Za-z0-9_])cf(?:k|ut|at)_[A-Za-z0-9]{40}[0-9a-fA-F]{8}(?![A-Za-z0-9_])/g],
  ["Telegram 机器人令牌", /(?<!\d)\d{7,12}:A[A-Za-z0-9_-]{33,34}(?![A-Za-z0-9_-])/g],
  ["JWT", /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/g],
  ["Slack 令牌", /xox[baprs]-/g],
  ["PuTTY 私钥", /^\s*["']?PuTTY-User-Key-File-[23]: /g],
];

const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----/g;

// 私钥头后面跟着正文才算：同一行接 \n 转义或 base64，或之后几行内（跳过空行和 Key: value 头字段）出现整行 base64。
// 只提到私钥头、正文写成 ... 的说明文字不算。
function hasKeyBody(rest, lines, i) {
  if (/^\s*(?:\\r)?\\n|^\s*[A-Za-z0-9+/]{20}/.test(rest)) return true;
  if (rest.replace(/["',\s]/g, "") !== "") return false;
  for (let j = i + 1; j < lines.length && j <= i + 5; j++) {
    const text = lines[j].trim().replace(/^["'>]+|["',]+$/g, "");
    if (/^[A-Za-z0-9+/]{40,}={0,2}$/.test(text)) return true;
    if (text !== "" && !/^[A-Za-z][\w-]*: /.test(text)) return false;
  }
  return false;
}

// URL 里内嵌的密码；示例域名（RFC 2606）和 password、pass 这类占位词不算。
const URL_CREDENTIAL =
  /(?<![A-Za-z0-9+.-])[a-z][a-z0-9+.-]{1,15}:\/\/[^\s:/?#@'"\x60<>]*:([^\s/?#@'"\x60<>]+)@([^\s/?#@'"\x60<>:]+)/gi;
const EXAMPLE_HOST = /(?:^|\.)(?:example(?:\.com|\.net|\.org)?|invalid|test)$/i;
const PLACEHOLDER_PASSWORD = /^(?:password|passwd|pass|pwd|secret|token|changeme)$/i;

// 请求头里的 Bearer、Basic 凭据是机器生成的，只在值像随机串时才报，避免误中“Bearer token”这类说明。
const AUTH_HEADER = /(?<![A-Za-z0-9])(?:Bearer|Basic) +([A-Za-z0-9._~+/-]+=*)/g;

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
// 不加引号的令牌类赋值（CF_API_TOKEN=…、api_key: …）只在值像随机串时才报：这类键名后面常跟说明文字或变量名。
const UNQUOTED =
  /(?<![A-Za-z0-9_.-])["']?([A-Za-z0-9_.-]*?(?:token|secret|api[_-]?key|access[_-]?key|private[_-]?key|auth[_-]?key))["']?[ \t]*[:=][ \t]*([^\s"'\x60,;&#<>()[\]{}]+)/gi;
const ASSIGNMENT = /password\s*[:=]\s*(\S+)/gi;

// 指向别处而不是秘密本身的值：占位符（<password>、***、{{ var }}）、路径、变量名、中文说明，
// 以及代码里的表达式（PowerShell 命令如 Read-Host、函数调用或下标如 os.environ["X"]）。
const REFERENCE_PREFIXES = ["<", "{{", "$", "%", "~", "/", "./", "../"];
function isReference(raw) {
  const value = raw.trim().replace(/^["'\x60]+|["'\x60,;。，；]+$/g, "");
  return (
    value === "" ||
    /^[*.xX•…_-]+$/.test(value) ||
    /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value) ||
    REFERENCE_PREFIXES.some((prefix) => value.startsWith(prefix)) ||
    /[\u3400-\u9fff\uf900-\ufaff]/.test(value) ||
    /^[A-Z][a-z]+-[A-Z][A-Za-z]+$/.test(value) ||
    /^[A-Za-z_$][\w.$]*[([]/.test(value)
  );
}

function detect(line, lines, i) {
  for (const match of line.matchAll(PRIVATE_KEY)) {
    if (hasKeyBody(line.slice(match.index + match[0].length), lines, i)) return "私钥";
  }
  for (const [kind, pattern, keep] of TOKENS) {
    for (const match of line.matchAll(pattern)) {
      if (!looksFake(match[0].replace(/^\d+:/, "")) && (!keep || keep(match[0]))) return kind;
    }
  }
  for (const match of line.matchAll(URL_CREDENTIAL)) {
    const [, password, host] = match;
    if (!isReference(password) && !PLACEHOLDER_PASSWORD.test(password) && !EXAMPLE_HOST.test(host)) return "URL 内嵌密码";
  }
  for (const match of line.matchAll(AUTH_HEADER)) {
    if (looksRandom(match[1]) && !looksFake(match[1])) return "请求头凭据";
  }
  for (const pattern of NOTATIONS) {
    for (const match of line.matchAll(pattern)) {
      if (!isReference(match[1] ?? match[2] ?? match[3] ?? "")) return "凭据值";
    }
  }
  for (const match of line.matchAll(UNQUOTED)) {
    const value = match[2];
    // 值后面紧跟 ( 或 [，是函数调用或下标，不是字面量。
    const code = /^[([]/.test(line.slice(match.index + match[0].length));
    if (!code && !isReference(value) && looksRandom(value) && !looksFake(value)) return "凭据值";
  }
  for (const match of line.matchAll(ASSIGNMENT)) if (!isReference(match[1])) return "密码";
  return null;
}

/** 逐行扫描整份文本（含页面头和代码块），每行最多报一次；返回 [{ line, kind }]。 */
export function scanSecrets(text) {
  const lines = text.split(/\r?\n/);
  return lines.flatMap((line, i) => {
    if (line.includes(ALLOW_MARKER)) return [];
    const kind = detect(line, lines, i);
    return kind ? [{ line: i + 1, kind }] : [];
  });
}
