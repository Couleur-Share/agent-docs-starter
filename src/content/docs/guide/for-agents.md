---
title: AI 查阅入口
description: 本机 AI 怎样发现并查阅本站，以及网站提供给远程 AI 的接口。
aliases: [Skill, 查询脚本, llms.txt]
sidebar:
  order: 2
---

本机 AI 读的是源文件，不是网站。让它稳定地先查再做，靠三样东西：查阅 Skill、写回 Skill，以及可选的用户规则。

## 本机 Skill

Skill 模板在仓库的 `agent-kit/skills/`，站点信息在 `agent-kit/site.json`：

| 字段 | 作用 |
| --- | --- |
| `slug` | Skill 名前缀，安装后得到 `<slug>-lookup` 和 `<slug>-writeback` |
| `name` | 站点名称 |
| `scope` | 一句话写清本站是哪些事实的唯一来源 |
| `triggers` | 哪些任务要先查本站；写成具体场景，AI 据此判断什么时候调用 |

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
node scripts/docs-query.mjs find 维护            # 按标题、别名、摘要、路径找页面
node scripts/docs-query.mjs list                 # 全部页面与摘要
node scripts/docs-query.mjs outline /guide/maintenance/
node scripts/docs-query.mjs section /guide/maintenance/ 写作规则
```

`section` 默认省略 `data-history` 历史区，加 `--history` 才输出。

## 用户规则（可选）

Skill 靠描述触发，偶尔会被跳过。想更稳，可以再加一条 Cursor User Rule：

```sh
node scripts/install-skills.mjs --print user-rule
```

把输出粘贴到 Cursor 设置的 Rules 里。User Rules 跟着 Cursor 账号同步到所有电脑，所以生成的规则末尾带有“本机没有上述目录时忽略本条”。

## 网站上的 AI 接口

网站部署后，Nimbus 自动提供：

- 每页的 Markdown 版本：在页面地址后加 `index.md`。
- 全站索引 `/llms.txt`、各分区的 `llms.txt`，以及全文合集 `/llms-full.txt`。

页面头里的 `aliases`、`status`、`supersededBy`、`reviewed` 也会写进这些 Markdown 版本。部署前先把 `astro.config.ts` 里的 `site` 改成正式地址，这些接口里的链接都依赖它。
