---
type: Reference
title: AI 查阅入口
description: 本机 AI 怎样发现、查阅和写回本站，以及网站提供给远程 AI 的接口。
tags: [AI, Skill]
aliases: [Skill, 查询脚本, llms.txt]
generated: { by: cursor-agent/claude-opus-5.5, at: 2026-11-07T13:46:35+08:00 }
verified: { by: cursor-agent/claude-opus-5.5, at: 2026-11-07T13:46:35+08:00 }
stale_after: 2027-05-06T13:46:35+08:00
sidebar:
  order: 2
---

本机 AI 读的是源文件，不是网站。让它稳定地先查再做、做完写回，靠三样东西：查阅 Skill、写回 Skill，以及可选的用户规则。

## 本机 Skill

Skill 模板在仓库的 `agent-kit/skills/`，站点信息在 `agent-kit/site.json`：

| 字段 | 作用 |
| --- | --- |
| `slug` | Skill 名前缀，安装后得到 `<slug>-lookup` 和 `<slug>-writeback` |
| `name` | 站点名称 |
| `scope` | 一句话写清本站是哪些事实的唯一来源 |
| `owner` | 你的标识；你亲自核验的内容记为 `human:<owner>` |
| `triggers` | 哪些任务要先查本站；写成具体场景，AI 据此判断什么时候调用 |
| `reviewDays` | 各页面类型的复核期限（天），用于推算 `stale_after` |

安装与核对：

```sh
node scripts/install-skills.mjs            # 渲染后装进 ~/.cursor/skills 和 ~/.codex/skills
node scripts/install-skills.mjs --check    # 核对已安装的副本与模板一致
node scripts/install-skills.mjs --dry-run  # 只显示会写到哪里
```

默认只装到本机已有的目录（`~/.cursor`、`~/.codex`），用 `--target cursor,codex` 可以指定。Skill 是本机文件，不随账号同步，每台要查本站的电脑都装一次。改了模板、`site.json` 或仓库位置之后，重新安装再跑 `--check`。

模板没有放在仓库根目录的 `skills/`：Nimbus 会把那里的 Skill 公开发布到站点的 `/.well-known/agent-skills/`。

## 查询脚本

`scripts/docs-query.mjs` 只用 Node 内置模块，在别的项目里也能直接调用：

```sh
node scripts/docs-query.mjs find 维护            # 按标题、别名、标签、摘要、路径找页面
node scripts/docs-query.mjs list                 # 全部页面与摘要
node scripts/docs-query.mjs outline /guide/maintenance/
node scripts/docs-query.mjs section /guide/maintenance/ 写作规则
```

每条结果标出页面类型和方括号里的状态：草稿或已弃用、信任等级（未核验、机器核验、人工核验），以及过了 `stale_after` 的“已过期”。`section` 默认省略 `data-history` 历史区，加 `--history` 才输出。

## 时间戳脚本

`scripts/okf-stamp.mjs` 输出要写进页面头的 `generated`、`verified` 与 `stale_after`，时间带时区偏移，复核期限按页面类型从 `reviewDays` 读取。它只打印结果，不改文件：

```sh
node scripts/okf-stamp.mjs verified Playbook --by cursor-agent/claude-opus-5.5
```

## 用户规则（可选）

Skill 靠描述触发，偶尔会被跳过。想更稳，可以再加一条 Cursor User Rule：

```sh
node scripts/install-skills.mjs --print user-rule
```

把输出粘贴到 Cursor 设置的 Rules 里。User Rules 跟着 Cursor 账号同步到所有电脑，所以生成的规则末尾带有“本机没有上述目录时忽略本条”。

## 网站上的 AI 接口

网站部署后，Nimbus 自动提供：

- 每页的 Markdown 版本：在页面地址后加 `index.md`；加 `index.mdx` 得到含组件写法的正文。
- 全站索引 `/llms.txt`、各分区的 `llms.txt`，以及全文合集 `/llms-full.txt`。

这些接口的页面头只带 `type`、`tags`、`status`、`stale_after`、`aliases`、`supersededBy` 这类简单字段；`generated`、`verified`、`sources` 是嵌套结构，Nimbus 不输出，只在仓库的源文件里。需要核验信息的 AI 应该读源文件。

部署前先把 `astro.config.ts` 里的 `site` 改成正式地址，这些接口里的链接都依赖它。
