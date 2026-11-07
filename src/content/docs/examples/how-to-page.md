---
type: Playbook
title: 操作步骤页示例
description: 演示操作步骤页的写法，从目标、前提、步骤一直写到验收与回退。
tags: [示例, 操作步骤]
aliases: [示例步骤页, how-to example]
generated: { by: cursor-agent/claude-opus-5.5, at: 2026-11-07T13:46:35+08:00 }
sidebar:
  order: 2
---

操作步骤页回答“怎么做”。开头写清目标和适用范围，再按顺序写步骤，最后写怎么确认做成了。本页没有 `verified`，查询结果会标为“未核验”。

## 前提

- 已安装 Node.js 22.12 或更高版本。
- 已在仓库根目录执行 `npm ci`。

## 步骤

1. 新建页面文件，例如 `src/content/docs/brand/colors.md`。
2. 写好页面头的 `type`、`title`、一句完整的 `description`、`tags` 和 `generated`。
3. 运行 `npm test` 检查写法。
4. 运行 `npm run dev`，在浏览器里确认页面出现在左侧目录。

## 验收

- `npm test` 没有错误。
- `node scripts/docs-query.mjs find <页面标题>` 能找到新页面。

## 回退

删除新建的文件，再运行一次 `npm test`。
