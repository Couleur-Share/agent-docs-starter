---
name: {{SLUG}}-writeback
description: >-
  把新的事实、决定和流程写回「{{NAME}}」，它是{{SCOPE}}的唯一事实来源。在任何项目里，只要本次任务定下或改变了上述内容，或用户要求更新这份文档，就用本 Skill 收尾。只读查阅用 {{SLUG}}-lookup。
---

{{MARKER}}

# {{NAME}}写回

仓库：`{{REPO_DIR}}`，页面源文件在 `{{DOCS_DIR}}`。写作约定以仓库根目录的 `AGENTS.md` 为准，页面头遵循 [OKF v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)；本 Skill 只给流程。

## 什么时候写

- 本次任务定下或改变了{{SCOPE}}中的内容。
- 用户要求更新这份文档。
- 发现文档与实际不一致，并且已经确认了实际情况。

纯查询、没有产生新事实时不写。

## 步骤

1. 用 `{{QUERY}} find <关键词>` 找到这件事唯一的维护页面。已有页面就改它，不另起重复页面；拿不准归属时先问用户。
2. 正文只写现状：直接改正文，不在末尾追加流水账。被取代的旧做法移进页尾的 `<div data-history>` 折叠区，或者整页标为 `status: deprecated` 并填写 `supersededBy`。
3. 新页面写 `.md`，页面头必须有 `type`、`title`、一句完整的 `description`、`tags` 和 `generated`（见下一步），需要时补 `aliases`。常用类型及复核期限：{{REVIEW_DAYS}}。首页和分区首页用 `index.mdx`、`type: Overview`；不要用 `index.md`、`log.md` 作文件名。
4. 新建页面或每次实质改动后，用下面的命令生成 `generated`，写进页面头（已有就替换原来那一行）：

   ```text
   {{STAMP}} generated --by <作者>
   ```

5. 只有对照实际情况核实过内容，才写 `verified`。下面的命令同时生成按复核期限推算的 `stale_after`：

   ```text
   {{STAMP}} verified <页面类型> --by <核验者>
   ```

   原来已有核验记录时，把 `verified` 改成列表并追加这一条，`stale_after` 用新算出的值。
6. 有据可查的说法写进 `sources`（每条必须有 `resource`）；要标注单句出处时，用 `[^id]` 脚注对应 `sources` 里的 `id`。
7. 运行 `{{CHECK}}`，有错误就修到通过。
8. 在仓库里只暂存本次改动的文件（`git add -- <文件>`）并提交，提交信息写清改了什么。是否推送按 `AGENTS.md` 的约定；没有约定时先问用户。

`<作者>` 和 `<核验者>` 的写法：你自己写的或核对的，写 `<工具>/<模型>`，例如 `cursor-agent/claude-opus-5.5`；用户亲自写的或确认的，写 `human:{{OWNER}}`；自动流程写 `process:<名称>`。用户没有亲自确认时，不要替用户写 `human:`。

## 边界

- 不写密钥、口令、Token、授权码或私人联系方式，只写它们存放在哪里。
- Nimbus 的 `draft: true` 表示页面不发布，和 OKF 的 `status: draft`（未定稿）不是一回事，不要混用。
- 不顺手改与本次事实无关的页面。
