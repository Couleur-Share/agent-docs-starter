# AGENTS.md

本仓库是一个给人看、也给 AI 查的文档站，由模板 [agent-docs-starter](https://github.com/Couleur-Share/agent-docs-starter) 派生。本文件只放内容方面的硬约束和指针；改网站代码（组件、布局、路由、Nimbus 升级）的规则见 `AGENT.md`。

## 这个仓库是什么

- 页面源文件在 `src/content/docs/`，是 `agent-kit/site.json` 里 `scope` 所写内容的唯一事实来源。
- 页面头遵循 **Open Knowledge Format（OKF）v0.2**，依据的是 [这一版 SPEC.md](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/0b87c52c6ef999286c745e19998fdfcd03d5dbee/SPEC.md)（最新版在 [main 分支](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)）。规范以 Apache-2.0 许可发布，本仓库只放链接、不复制原文；确需复制时必须同时保留其 Apache-2.0 声明。OKF 发布新版本时，先评估影响，再一起修改本文件、`src/content.config.ts` 和 CI 里锁定的 OKF 校验器版本。
- 完整的维护约定在 `src/content/docs/guide/maintenance.md`。
- 如果 `agent-kit/site.json` 里还有 `TODO`，说明还没定制：先按 `README.md` 的「给 AI 的起步步骤」完成。

## 写作硬约束

1. 普通页面用 `.md`，页面头必须有 `type`、`title`、一句完整的 `description`（不以冒号、逗号或分号结尾）、`tags` 和 `generated`。首页和分区首页用 `index.mdx`，`type: Overview`。
2. 不要用 `index.md`、`log.md` 作文件名：它们是 OKF 保留的目录清单和更新日志文件名。
3. `status` 取 `draft`、`stable`（缺省）或 `deprecated`。被取代的页面写 `status: deprecated`，再加指向现行页面的 `supersededBy`。Nimbus 的 `draft: true`（不发布）和 OKF 的 `status: draft`（未定稿）不是一回事。
4. 时间写成带时区偏移的 ISO 8601。`generated`、`verified`、`stale_after` 用 `node scripts/okf-stamp.mjs` 生成；只有核实过内容才写 `verified`，用户没有亲自确认时不要写 `human:`。
5. 正文不写一级标题，只写现状。被取代的做法放进页尾 `<div data-history>` 里的 `<details>`，或整页移到 `archive/`。
6. 每类事实只在一个页面维护，其他页面链接过去，不抄写。
7. 单行不超过 500 字；易变的数值带日期。
8. 不写密钥、口令、Token 和授权码，只写存放位置。
9. 新的扩展键先在 `src/content.config.ts` 里声明，否则严格校验会让构建失败。

## 改完必跑

- 改了内容：`npm test`（内容检查、秘密扫描和脚本单测）。
- 改了站点代码或依赖：再跑 `npm run typecheck` 和 `npm run build`。Windows 上 `npx @cloudflare/nimbus-docs check` 的类型检查会误报 `.astro` 模块找不到，以 `npm run typecheck` 为准。
- OKF 合规由 CI 里的 OKF 校验器在严格模式下检查（任何警告都算失败）；本机想提前跑，见 README 的「本地开发」。
- Nimbus 的 `lint` 只检查 `.mdx`；`.md` 页面由 `npm test` 里的内容检查负责。

## 提交

- 只暂存本次改动的文件（`git add -- <文件>`）；不提交 `dist/`、`.astro/`、`node_modules/`。
- 推送约定：文档改动提交后先问用户再推送。用户给过常驻授权的话，把这一条改成“提交后直接推送”。

## AI 入口

- Skill 模板在 `agent-kit/skills/`，用户规则模板在 `agent-kit/user-rule.md`，站点信息（含 `owner` 和各类型的复核期限 `reviewDays`）在 `agent-kit/site.json`。改了其中任何一处，或者仓库换了位置，都要运行 `node scripts/install-skills.mjs` 重新安装，再用 `--check` 核对。
- 不要把 Skill 模板放进仓库根目录的 `skills/`：Nimbus 会把那里的 Skill 公开发布到站点上。
