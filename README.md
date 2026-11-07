# agent-docs-starter

一个给人看、也给 AI 查的文档站模板。网站部分由 [Nimbus](https://nimbus-docs.com/)（Cloudflare 基于 Astro 的文档框架）生成；本模板补上了让本机 AI “先查文档再动手、做完写回”的那一层：页面头约定、内容检查、查询脚本，以及可以一键安装的查阅与写回 Skill。

适合给某个领域建立唯一事实来源，例如设计规范、个人基础设施、团队流程，让 Cursor、Codex 等 AI 在任何项目里都按它办事。

## 和 Nimbus 的分工

| 部分 | 来源 |
| --- | --- |
| 网站、导航、搜索、每页的 Markdown 版本、`llms.txt` | Nimbus（`@cloudflare/nimbus-docs`） |
| 页面头字段 `aliases`、`status`、`supersededBy`、`reviewed` | `src/content.config.ts` |
| 内容检查：一句话摘要、取代链、核实日期、一级标题、重名、长行 | `scripts/check-content.mjs` |
| 查询脚本：找页面、列章节、取一节 | `scripts/docs-query.mjs` |
| 查阅与写回 Skill、用户规则的模板 | `agent-kit/`，用 `scripts/install-skills.mjs` 安装 |
| 给 AI 的仓库约定 | `AGENTS.md`（内容）；`AGENT.md`（Nimbus 提供，站点代码） |

查询、检查和安装脚本只用 Node 内置模块，不装依赖也能运行。

## 环境要求

- Node.js 22.12 或更高版本，推荐 24 LTS
- Git；要推到 GitHub 的话，再装 GitHub CLI 并登录（`gh auth login`）

## 给 AI 的起步步骤

在新电脑上对 AI 说一句“按 https://github.com/Couleur-Share/agent-docs-starter 的 README 建一个 <领域> 文档站”，AI 按下面的步骤执行。

1. **确认环境**：`node --version`（至少 22.12）、`git --version`、`gh auth status`。缺什么先告诉用户，不要自行安装。
2. **克隆并保留上游**。不要用 GitHub 的 “Use this template”：那样生成的仓库和模板没有共同历史，以后合并不了模板更新。

   ```sh
   git clone https://github.com/Couleur-Share/agent-docs-starter.git <目录>
   cd <目录>
   git remote rename origin upstream
   ```

3. **建私有仓库并推送**。仓库名和账号问用户：

   ```sh
   gh repo create <账号>/<仓库名> --private --source . --remote origin --push
   ```

4. **装依赖并自检**：`npm ci`、`npm test`、`npm run build`，三步都要通过。
5. **和用户一起定制**：
   - `agent-kit/site.json`：填写 `slug`、`name`、`scope`、`triggers`，去掉全部 `TODO`。`triggers` 写成具体的任务场景，AI 靠它判断什么时候该查本站。
   - `astro.config.ts`：改 `title`、`description`、`github`；部署时再改 `site`。
   - `src/content/docs/`：按领域规划分区，一个分区一个目录，目录里放 `index.md` 并用 `sidebar.group.label` 写分区名。重写首页，把[维护约定](src/content/docs/guide/maintenance.md)里的“唯一维护位置”表换成本站的分类，删除 `examples/` 目录和 `archive/old-naming.md`。
   - `AGENTS.md`：确认推送约定。
6. **安装 Skill**：运行 `node scripts/install-skills.mjs`，再运行 `node scripts/install-skills.mjs --check`。如果用户想要用户规则，运行 `node scripts/install-skills.mjs --print user-rule`，请用户把输出粘贴到 Cursor 设置的 Rules 里。
7. **验收**：
   - `npm test` 与 `npm run build` 通过。
   - 在仓库之外的目录运行 `node <仓库>/scripts/docs-query.mjs find <关键词>`，能找到页面。
   - 新开一个其他项目的对话，问一个本站范围内的问题，AI 应该先调用 `<slug>-lookup`。
8. **提交并推送**。

## 本地开发

```sh
npm ci
npm run dev        # 开发服务器
npm test           # 脚本单测 + 内容检查
npm run typecheck  # astro check
npm run build      # 生产构建，含 Pagefind 搜索索引
npm run preview    # 预览构建结果，站内搜索在这里才能用
```

## 合并模板更新

```sh
git fetch upstream
git merge upstream/main
```

冲突通常只出现在你定制过的文件（`agent-kit/site.json`、`astro.config.ts`、`AGENTS.md`、示例页）；你自己写的内容页不受影响。Nimbus 本身的升级按 `AGENT.md` 的 “Upgrading Nimbus” 执行。

## 已知问题

- Windows 上 `npx @cloudflare/nimbus-docs check` 的类型检查会误报 `.astro` 模块找不到（Nimbus 0.19.3），以 `npm run typecheck` 为准；GitHub Actions 在 Linux 上照常运行它。
- `npm ci` 会提示 esbuild 的安装脚本没有获准运行（npm 11 的 `allowScripts`），不影响构建。

## 许可证

MIT，见 [LICENSE](LICENSE)。由 `@cloudflare/create-nimbus-docs` 生成的文件版权归 Cloudflare, Inc.，同样以 MIT 许可发布。
