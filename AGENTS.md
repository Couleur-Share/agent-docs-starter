# AGENTS.md

本仓库是一个给人看、也给 AI 查的文档站，由模板 [agent-docs-starter](https://github.com/Couleur-Share/agent-docs-starter) 派生。本文件只放内容方面的硬约束和指针；改网站代码（组件、布局、路由、Nimbus 升级）的规则见 `AGENT.md`。

## 这个仓库是什么

- 页面源文件在 `src/content/docs/`，是 `agent-kit/site.json` 里 `scope` 所写内容的唯一事实来源。
- 完整的维护约定（唯一维护位置、页面头字段、写作规则、历史写法、写回流程）在 `src/content/docs/guide/maintenance.md`。
- 如果 `agent-kit/site.json` 里还有 `TODO`，说明还没定制：先按 `README.md` 的「给 AI 的起步步骤」完成。

## 写作硬约束

1. 页面头必须有 `title` 和一句完整的 `description`（不以冒号、逗号或分号结尾）。`status` 取 `current`、`historical` 或 `superseded`，`superseded` 必须带指向现行页面的 `supersededBy`。`reviewed` 只在核实内容后更新，格式为 `YYYY-MM-DD`。
2. 页面默认用 `.md`，只有要用组件时才用 `.mdx`。
3. 正文不写一级标题，只写现状。被取代的做法放进页尾 `<div data-history>` 里的 `<details>`，或整页移到 `archive/` 并改状态。
4. 每类事实只在一个页面维护，其他页面链接过去，不抄写。
5. 单行不超过 500 字；易变的数值带日期。
6. 不写密钥、口令、Token 和授权码，只写存放位置。

## 改完必跑

- 改了内容：`npm test`（内容检查和脚本单测）。
- 改了站点代码或依赖：再跑 `npm run typecheck` 和 `npm run build`。Windows 上 `npx @cloudflare/nimbus-docs check` 的类型检查会误报 `.astro` 模块找不到，以 `npm run typecheck` 为准。
- Nimbus 的 `lint` 只检查 `.mdx`；`.md` 页面由 `npm test` 里的内容检查负责。

## 提交

- 只暂存本次改动的文件（`git add -- <文件>`）；不提交 `dist/`、`.astro/`、`node_modules/`。
- 推送约定：文档改动提交后先问用户再推送。用户给过常驻授权的话，把这一条改成“提交后直接推送”。

## AI 入口

- Skill 模板在 `agent-kit/skills/`，用户规则模板在 `agent-kit/user-rule.md`，站点信息在 `agent-kit/site.json`。改了其中任何一处，或者仓库换了位置，都要运行 `node scripts/install-skills.mjs` 重新安装，再用 `--check` 核对。
- 不要把 Skill 模板放进仓库根目录的 `skills/`：Nimbus 会把那里的 Skill 公开发布到站点上。
