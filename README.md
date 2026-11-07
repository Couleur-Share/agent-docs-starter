# agent-docs-starter

一个给人看、也给 AI 查的文档站模板。网站部分由 [Nimbus](https://nimbus-docs.com/)（Cloudflare 基于 Astro 的文档框架）生成；页面头采用 [Open Knowledge Format（OKF）v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)；本模板补上了让本机 AI “先查文档再动手、做完写回”的那一层：内容与秘密检查、查询与时间戳脚本，以及可以一键安装的查阅与写回 Skill。

适合给某个领域建立唯一事实来源，例如设计规范、个人基础设施、团队流程，让 Cursor、Codex 等 AI 在任何项目里都按它办事。

## 各部分的来源

| 部分 | 来源 |
| --- | --- |
| 网站、导航、搜索、每页的 Markdown 版本、`llms.txt` | Nimbus（`@cloudflare/nimbus-docs`） |
| 页面头格式：`type`、`status`、`generated`、`verified`、`stale_after`、`sources` 等 | OKF v0.2；本站扩展 `aliases`、`supersededBy`；字段声明在 `src/content.config.ts` |
| OKF 合规检查 | CI 里的 [scaccogatto/okf-skills](https://github.com/scaccogatto/okf-skills) 校验器，锁定 `okf--v0.12.0`；缺页面头或缺 `type` 时失败，其余问题列为警告 |
| 本站写法检查：一句话摘要、正文一级标题、长行、取代链、保留文件名、重名、泄露秘密 | `scripts/check-content.mjs`，秘密扫描规则参考 [dotinfra](https://github.com/PiotrTopa/dotinfra) |
| 查询脚本：找页面、列章节、取一节，标出状态、信任等级与是否过期 | `scripts/docs-query.mjs` |
| 时间戳脚本：生成带时区的 `generated`、`verified` 与按页面类型推算的 `stale_after` | `scripts/okf-stamp.mjs` |
| 查阅与写回 Skill、全局规则的模板 | `agent-kit/`，用 `scripts/install-skills.mjs` 安装（Codex 的全局规则一并写入，Cursor 的按下文添加） |
| 多台电脑同步 | Git：查阅前自动拉取，写回后自动提交并推送 |
| 给 AI 的仓库约定 | `AGENTS.md`（内容）；`AGENT.md`（Nimbus 提供，站点代码） |

`scripts/` 下的脚本只用 Node 内置模块，不装依赖也能运行；`npm test` 不需要 Python。

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
   - `agent-kit/site.json`：填写 `slug`、`name`、`scope`、`owner`、`triggers`，去掉全部 `TODO`；按需调整 `reviewDays`（各页面类型的复核期限天数）。`triggers` 写成具体的任务场景，AI 靠它判断什么时候该查本站；`owner` 是用户的标识，用户亲自核验的内容记为 `human:<owner>`。
   - `astro.config.ts`：改 `title`、`description`、`github`；部署时再改 `site`。
   - `src/content/docs/`：按领域规划分区，一个分区一个目录，目录里放 `index.mdx` 并用 `sidebar.group.label` 写分区名。重写首页，把[维护约定](src/content/docs/guide/maintenance.md)里的“唯一维护位置”表换成本站的分类，删除 `examples/` 目录和 `archive/old-naming.md`。
   - `AGENTS.md`：推送约定默认是“提交后直接推送”，多台电脑靠它同步；用户想先问再推时改那一条。
6. **安装 Skill 与全局规则**：按下面的「安装 Skill 与全局规则」执行。
7. **验收**：
   - `npm test` 与 `npm run build` 通过，推送后 GitHub Actions 里的 OKF 检查通过。
   - 在仓库之外的目录运行 `node <仓库>/scripts/docs-query.mjs find <关键词>`，能找到页面。
   - 新开一个其他项目的对话，问一个本站范围内的问题，AI 应该先调用 `<slug>-lookup`。
8. **提交并推送**。以后 AI 写回时会自动提交并推送，其他电脑查阅前会自动拉取。

## 安装 Skill 与全局规则

每台要查、要写这份文档的电脑都做一次：

1. 运行 `node scripts/install-skills.mjs`，再运行 `node scripts/install-skills.mjs --check`。它把查阅、写回两个 Skill 装进 `~/.cursor/skills` 和 `~/.codex/skills`，并在 `~/.codex/AGENTS.md` 里写入本站的全局规则（带标记的一段，重装只替换这一段）。
2. 添加 Cursor 的全局规则。它是账号级的 User Rule，多台电脑登录同一账号时，通常只需要添加一次：
   - 运行 `node scripts/install-skills.mjs --print user-rule`，取得规则文字，先给用户过目。
   - 用 Cursor 的规则工具（`cursor_dialog`，`item: "rule"`、`scope: "user"`）先 `list`。已有提到 `<slug>-lookup` 的规则时，内容一致就跳过，不一致就 `update`；没有时 `add`，标题写“<站点名称>：先查后做、做完写回”。
   - 当前 Cursor 没有这个工具时，请用户把规则文字粘贴到 Cursor 设置的 Rules 里。
3. 新开一个对话，Skill 和规则才会生效。

全局规则只提到 Skill 名，不写本机路径；路径在各台电脑自己安装的 Skill 里。本机没有装 Skill 的电脑会忽略这条规则。

## 在另一台电脑上接入

文档仓库已经建好，要在另一台电脑上也能查、能写回时，对那台电脑的 AI 说“按 <账号>/<仓库名> 仓库 README 的「在另一台电脑上接入」接入”，AI 按下面执行：

1. 确认环境：`node --version`（至少 22.12）、`git --version`、`gh auth status`。
2. 克隆：`gh repo clone <账号>/<仓库名> <目录>`。只查阅和写回不需要 `npm ci`；要在本机预览网站或运行 `npm test` 时再装依赖。
3. 按上面的「安装 Skill 与全局规则」执行。Cursor 的规则多半已随账号同步过来，`list` 确认即可。
4. 验收：在仓库之外的目录运行 `node <目录>/scripts/docs-query.mjs list` 能列出页面；新开一个其他项目的对话，问一个本站范围内的问题，AI 应该先调用 `<slug>-lookup`。

## 本地开发

```sh
npm ci
npm run dev        # 开发服务器
npm test           # 脚本单测 + 内容检查 + 秘密扫描
npm run typecheck  # astro check
npm run build      # 生产构建，含 Pagefind 搜索索引
npm run preview    # 预览构建结果，站内搜索在这里才能用
npm run docs:stamp -- verified Reference --by human:alice   # 生成核验时间与复核期限
```

想在本机提前跑 OKF 校验：需要 Python 3.11+ 和 PyYAML，下载与 CI 同一提交的 [okf_validate.py](https://raw.githubusercontent.com/scaccogatto/okf-skills/49f8fb4987989b7a443ce278c6aa68ba0493b51f/skills/validate/scripts/okf_validate.py)，在仓库根目录运行 `python okf_validate.py src/content/docs`，与 CI 一样只在硬错误时失败；加 `--strict` 则把警告也算作失败。它只检查 `.md` 文件，`index.mdx` 首页不在检查范围内。

## 合并模板更新

```sh
git fetch upstream
git merge upstream/main
```

冲突通常只出现在你定制过的文件（`agent-kit/site.json`、`astro.config.ts`、`AGENTS.md`、示例页）；你自己写的内容页不受影响。Nimbus 本身的升级按 `AGENT.md` 的 “Upgrading Nimbus” 执行。

## 已知问题

- Windows 上 `npx @cloudflare/nimbus-docs check` 的类型检查会误报 `.astro` 模块找不到（Nimbus 0.19.3），以 `npm run typecheck` 为准；GitHub Actions 在 Linux 上照常运行它。
- 网站给 AI 的 Markdown 接口只输出简单的页面头字段；`generated`、`verified`、`sources` 是嵌套结构，Nimbus 不输出，只在源文件里。

## 许可证

MIT，见 [LICENSE](LICENSE)。由 `@cloudflare/create-nimbus-docs` 生成的文件版权归 Cloudflare, Inc.，同样以 MIT 许可发布。OKF 规范（Apache-2.0）只以链接引用，没有复制进本仓库。
