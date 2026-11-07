---
name: {{SLUG}}-lookup
description: >-
  只读查阅「{{NAME}}」的源文件，它是{{SCOPE}}的唯一事实来源。在任何项目里，只要遇到以下任务，先用本 Skill 查文档再动手：{{TRIGGERS_INLINE}}。只负责查阅；写文档与提交用 {{SLUG}}-writeback。
---

{{MARKER}}

# {{NAME}}查阅（只读）

{{SCOPE}}以「{{NAME}}」为准。本 Skill 只说明去哪找、怎么找、信到什么程度，不复制会变的事实。

## 什么时候查

{{TRIGGERS_LIST}}

## 读哪里

源文件目录：`{{DOCS_DIR}}`

- 直接读源文件，不抓网站：网站可能没有部署，或者落后于源文件。
- 目录不存在或读不到时，如实报告“文档源不可用”，不要用记忆或网上信息补。

## 怎么找

查询脚本只用 Node 内置模块，不需要安装依赖，在任何目录都能运行：

```text
{{QUERY}} find <关键词>          # 按标题、别名、标签、摘要、路径找页面
{{QUERY}} list                   # 列出全部页面与摘要
{{QUERY}} outline <页面>         # 章节、行号与字数
{{QUERY}} section <页面> <章节>  # 只输出一节，默认省略历史记录
```

`<页面>` 可写源文件相对路径、站内路由、页面标题或别名。结果的方括号里标出状态、信任等级和是否过期。

1. 先用 `find`；没有命中，再在源文件目录里按关键词搜正文。
2. 页面较长时先 `outline`，再用 `section` 取需要的章节，不整页读。
3. `<div data-history>` 里的内容是历史记录，只在追溯来龙去脉时读（`section` 加 `--history`）。

## 信到什么程度

页面头遵循 [OKF v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)：

- `status`：缺省或 `stable` 是现行约定；`draft` 还没定稿，照着做之前先问用户；`deprecated` 只当历史，有 `supersededBy` 就按它指向的页面执行。
- 信任等级看 `verified`：没有为“未核验”；只有工具或流程核验过为“机器核验”；有 `human:` 核验者为“人工核验”。
- `stale_after` 已过（结果里标“已过期”）：内容可能过时，用之前先对照实际情况核实，并告诉用户。
- `generated` 记录最后一次实质改动由谁、在何时完成；改过不等于核验过。
- 文档与实际文件或用户最新说法冲突时，以实际为准，告诉用户，并用 {{SLUG}}-writeback 修正文档。

## 边界

- 只读，不改文件。
- 文档里不存放密钥、口令、Token 和授权码；需要凭据时只看文档写明的存放位置。
