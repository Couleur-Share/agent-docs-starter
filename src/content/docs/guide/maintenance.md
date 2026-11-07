---
type: Reference
title: 维护约定
description: 本站的唯一维护位置、OKF 页面头字段、文件命名、写作规则、历史记录写法与写回流程。
tags: [约定, OKF]
aliases: [写作规范, 文档约定]
generated: { by: cursor-agent/claude-opus-5.5, at: 2026-11-07T13:57:41+08:00 }
verified: { by: cursor-agent/claude-opus-5.5, at: 2026-11-07T13:57:41+08:00 }
stale_after: 2027-05-06T13:57:41+08:00
sources:
  - id: okf-spec
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/0b87c52c6ef999286c745e19998fdfcd03d5dbee/SPEC.md
    title: Open Knowledge Format v0.2 规范
sidebar:
  order: 1
---

本页是本站写法的唯一来源。仓库根目录的 `AGENTS.md` 只摘录其中不可协商的几条，并指向这里。

## 唯一维护位置

每类事实只在一个地方维护，其他页面链接过去，不抄写。派生后把下表换成你自己的分类。

| 资料 | 维护位置 |
| --- | --- |
| 本站的写法与约定 | 本页 |
| AI 查阅方式与 Skill 安装 | [AI 查阅入口](/guide/for-agents/) |
| 各类页面的复核期限 | `agent-kit/site.json` 的 `reviewDays` |
| 已弃用的做法 | `archive/` 下的页面，状态标为 `deprecated` |
| 不属于本站的资料 | 留在原来的地方（项目仓库、收藏工具、密码管理器），本站只放链接 |

判断标准：内容是否属于本站范围，并且需要被反复查阅和遵守。临时笔记、收藏的外部文章和源文件本身都不进本站。

## 页面头字段

页面头遵循 Open Knowledge Format（OKF）v0.2，[^okf-spec] 下表是本站的用法：

| 字段 | 本站要求 | 写法 |
| --- | --- | --- |
| `type` | 必填 | 页面类型：`Reference`（规则、取值、清单）、`Playbook`（操作步骤）、`Decision`（决策记录）、`Overview`（首页和分区首页） |
| `title` | 必填 | 页面标题；正文不再写一级标题 |
| `description` | 必填 | 一句完整的话说明本页回答什么问题，AI 先靠它决定要不要读全文 |
| `tags` | 必填 | 跨分区的分类标签 |
| `status` | 否 | `stable`（缺省，现行）、`draft`（未定稿）或 `deprecated`（只当历史） |
| `generated` | 必填 | 最后一次实质改动由谁在何时完成：`{ by, at }` |
| `verified` | 核实后写 | 核验记录：一个 `{ by, at }`，或多次核验的列表 |
| `stale_after` | 核实后写 | 到期复核的时间点，过了就算过期 |
| `sources` | 有出处时写 | 证据来源列表，每条必须有 `resource`；单句出处用 `[^id]` 脚注对应 `id` |
| `aliases` | 否 | 本站扩展：别名、旧称、英文名，`find` 会一起匹配 |
| `supersededBy` | 被取代时写 | 本站扩展：取代它的现行页面路由，只用于 `status: deprecated` |

`index.mdx` 首页和分区首页只需要 `type: Overview`、`title` 和 `description`。

### 时间与核验者

- 时间一律写成带时区偏移的 ISO 8601，例如 `2026-11-07T13:46:35+08:00`，不要只写日期。
- `by` 写法：本人写 `human:<标识>`，AI 或工具写 `<工具>/<版本>`，自动流程写 `process:<名称>`。只有 `human:` 开头的核验才算人工核验。
- 编辑不等于核验：内容改了只更新 `generated`；对照实际情况核实过才更新 `verified` 与 `stale_after`。

### 复核期限

`stale_after` 等于核验时间加上该页面类型的复核期限。期限写在 `agent-kit/site.json` 的 `reviewDays`（模板默认 `Reference` 180 天）；没有列出的类型（例如 `Overview`）不写 `stale_after`。用脚本生成这几行，不要手算时间：

```sh
node scripts/okf-stamp.mjs verified Reference --by human:alice
node scripts/okf-stamp.mjs generated --by cursor-agent/claude-opus-5.5
```

## 文件与格式

- 普通页面用 `.md`；首页和分区首页用 `index.mdx`。
- `index.md` 和 `log.md` 是 OKF 保留的文件名（目录清单和更新日志），内容目录里不要用，`npm test` 会拦下。
- OKF 只约束 `.md` 文件，`.mdx` 页面不参与 OKF 校验。
- 其他页面只有要用组件时才用 `.mdx`：MDX 会把正文里裸写的 `{`、`<` 当成代码，构建会失败。
- Nimbus 的 `draft: true` 表示页面不发布，和 OKF 的 `status: draft`（未定稿）不是一回事。
- 新的扩展键先在 `src/content.config.ts` 里声明，否则严格校验会让构建失败。
- 新增分区就新建目录，并放一个 `index.mdx` 作为分区首页，在其中用 `sidebar.group.label` 写分区名。

## 写作规则

- 正文只写现状。情况变了就改正文，不在末尾追加流水账。
- 正文不写一级标题。OKF 规范里约定的小节（如 Schema、Examples）在本站写成二级标题。
- 单行不超过 500 字。搜索工具会截断长行，行尾的内容容易被 AI 漏读。
- 易变的数值写上日期，例如“截至 2026-11-07 共有 12 套模板”。
- 截图和示意图旁边用文字写清关键数值和用途，AI 靠文字检索。
- 站内链接写路由，例如 `/guide/maintenance/`；查询脚本能把路由解析回源文件。
- 不写密钥、口令、Token 和授权码，只写它们存放在哪里。`npm test` 会扫描疑似泄露的内容；确认是误报，就在同一行加上 `secret-scan:allow`（`.md` 写在 HTML 注释里，`.mdx` 写在 `{/* */}` 里）。

## 历史记录

被取代的做法有两种处理方式：

- **页内历史**：放在页尾，用 `<div data-history>` 包住若干 `<details>`。查询脚本默认跳过这一块，AI 只在追溯来龙去脉时才读。
- **整页取代**：把旧页面移到 `archive/`，改为 `status: deprecated` 并填写 `supersededBy`。

页内历史的写法：

```html
## 变更记录

<div data-history>
<details>
<summary>2026-11-07：改用新的命名规则</summary>

当时的做法和改动原因。

</details>
</div>
```

## 检查

| 检查 | 在哪里运行 | 管什么 |
| --- | --- | --- |
| `npm test` | 本机和 CI | 一句话摘要、正文一级标题、长行、取代链、保留文件名、重名、泄露秘密 |
| OKF 校验器 | CI | OKF v0.2 合规：缺页面头或 `type` 时失败；推荐字段、时间格式、核验者写法、来源与脚注的问题列为警告 |
| `npm run build` | 本机和 CI | 页面头的键名与类型，链接与组件 |

CI 日志里的 OKF 警告不会让检查失败，但仍要按本页约定修正。

## 写回流程

1. 用 `find` 找到这件事唯一的维护页面。已有页面就改它，不另起重复页面。
2. 把正文改成现状，旧内容按上一节处理。
3. 实质改动后更新 `generated`；核实过再更新 `verified` 和 `stale_after`。
4. 运行 `npm test`，有错误就修到通过。
5. 只暂存本次改动的文件并提交。

[^okf-spec]: Open Knowledge Format v0.2 规范
