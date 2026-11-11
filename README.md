# STG Learning Workbench

在 DeepSeek Harness 内继续你的 StepsToGreat 学习：读教学、写答案、核对历轮反馈，再用原生导师会话评估与讨论。

**v0.5.17 · 已在 DSH 0.2.2-rc.1 验收 · 本地 Markdown · MIT**

[下载最新版插件](https://github.com/wildcat430524/dsh-stg-learning/releases/latest) · [下载 STG Desk](https://github.com/wildcat430524/STG-Desk/releases/latest) · [下载 StepsToGreat ZIP](https://github.com/wildcat430524/StepsToGreat/archive/refs/heads/main.zip)

这是原 `dsh-stg-learning` 学习会话管理插件的完整工作台版本。STG Desk 仍可独立使用；两者读取同一个学习目录，工作台直接嵌入 DSH 的页面、主题与会话。模型、账户和推理设置由 DSH 管理。

## 界面与反馈

阅读器采用单列排版，代码框跟随浅色或深色主题。长代码在框内横向滚动，保留缩进。保存与刷新显示实际请求状态，导航动效遵循系统的减少动态效果设置。

## 工作方式

- 从 DSH 左侧“学习”进入专属 StepsToGreat 学习空间。只有“新学习”和“导入已有”两种起步方式，不再提供通用 DSH 工作区下拉菜单。
- “新学习”进入独立页面，仅填一个名称，再通过系统窗口选择父目录；新建独立文件夹，校验并复制完整同源框架、空白档案和规则。同名文件夹绝不覆盖。
- “导入已有”选择学习文件夹根目录；识别有效 StepsToGreat 项目后登记或复用，不复制、不覆盖。普通代码仓库不会混入学习列表。旧版目录可使用指向同一工作区内部的档案符号链接与课程 junction，无需迁移或复制。
- 打开已有学习空间后进入档案记录的当前课程和轮次。可通过顶部课程菜单搜索和切换课程。
- 新学习空间按你填写的主题、基础或具体任务开始。返回后可继续原对话，也可以改主题另开对话。
- 导师菜单和「学习会话」支持移出选中的对话，并从「已移出」恢复。
- 顶部左侧的轮次选择适用于教学引导、阅读、作答和复习。历史轮次可查看对应的原题、已保存作答和导师反馈，切回当前轮可继续草稿。
- 在当前轮填写 1–3 道题，保存时追加原答；保留旧作答、导师评估和正确答案栏目。
- 阅读区支持公式、代码、表格、图片；完整文档可用 STG Desk 同源的所见即所得编辑器，或 Markdown 源文编辑。
- 选中文字后提问，或保存答案后准备评估。导师侧栏、浮窗和完整主对话使用原生 DSH 会话，发送前可以在输入框核对请求。
- 查看文件中的学习档案和掌握证据，按原有顺序复习历史。软件保存答案不会自行判定掌握或推进下一课。
- 草稿可恢复；保存校验文件版本并备份，外部修改后保留你的草稿并提供对照。历史版本先预览再恢复。
- 前台每 5 秒检查当前文档、每 15 秒检查课程与档案，导师更新后自动刷新未编辑内容；有草稿时明确提示，不覆盖输入。
- 没有内部目录栏或抽屉；顶部导航支持窄窗口横向滚动，支持键盘焦点、Ctrl+S 和减少动态效果。

“阅读 / 作答 / 复习”是界面视图。“STG 学习导师”是 DSH 能力预设，按 StepsToGreat 的 Socratic 引导与掌握学习法处理教学。概念理解、逻辑正确、规范表达采用学科包的实际评估口径；有原答证据才允许推进。

## 安装与开始

1. 从 [GitHub Releases](https://github.com/wildcat430524/dsh-stg-learning/releases/latest) 下载 `dsh-stg-learning-0.5.17.tgz`。
2. 在 **DSH 0.2.2-rc.1** 的插件管理页面安装并启用。若显示 `restart-required`，保存当前工作后重启宿主。
3. 点击左侧“学习”。选择“新学习”创建全新的文件夹并初始化；或“导入已有 StepsToGreat 文件夹”，选择包含学习档案和协议/初始化标记的根目录。
4. 尚无课程时，进入学习初始化页，选择自然开始或 grill-me 式澄清，点击“打开导师，准备开场”，在完整原生输入框核对后发送；导师按目标交流 → 摸底 → 学习路线 → 第一课构建个性化学习。初始化本身不臆造课程或掌握记录。
5. 保存作答后点击“保存并准备评估”，在原生 DSH 输入框核对请求并发送。导师会重新读取学习文档。

命令行安装是备用入口，请明确使用与桌面端相同版本的 DSH 和目标 profile：

```text
dsh plugin --profile desktop add /absolute/path/dsh-stg-learning-0.5.17.tgz
```

使用 CLI 安装前，核对其版本和目标 profile。包的 `engines.dsh` 声明兼容的宿主版本，0.5.17 的本轮宿主验收使用 DSH 0.2.2-rc.1。

## 与现有生态协作

| 项目 | 职责 |
| --- | --- |
| [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) | 教学协议、学科评估、课程与学习档案格式 |
| [Steps2Great-skill](https://github.com/wildcat430524/Steps2Great-skill) | 供 Agent 使用的教学方法与参考规则 |
| [STG Desk](https://github.com/wildcat430524/STG-Desk) | 独立桌面阅读、编辑与作答入口 |
| 本插件 | DSH 内完整学习工作台、学习文件服务与原生导师会话编排 |
| DeepSeek Harness | 模型、账户、工具执行、会话、输入与插件生命周期 |

原有学习会话管理保留为工作台右上角的“学习会话”入口，仅显示当前已识别的学习空间，不再把任意工作区标成学习。0.1.x 的课程、阶段、置顶标记仍是个人整理，不会被转换成正式掌握证据。

## 数据与保存

| 数据 | 位置 |
| --- | --- |
| 教学、学生原答、评估、学习档案 | 原工作区 Markdown 文件 |
| 课程与原生会话关联、上次课程/文档/视图 | 工作区 `.stg-desk/workbench.json` |
| 文档备份与写入重试记录 | 工作区 `.stg-desk/` 的应用目录 |
| 未保存文档与作答草稿、栏宽等显示偏好 | DSH 页面所属的本机浏览器存储 |
| 会话、模型与凭据 | DSH 原生存储 |

写入需要已读取的版本与唯一操作 ID；重试不会重复追加同一份作答。插件内部同文件写入串行化，外部变化会触发冲突提示。跨进程编辑器仍可能在最终版本检查与文件替换的极短间隔中竞争，建议避免两个程序同时保存同一份文档。

卸载插件不会清除学习文件、备份、DSH 会话或旧的本机整理标记。应用不会读取模型密钥、切换全局模型或修改账户状态。

## 内容范围

- 当前文档支持 UTF-8 Markdown / TXT，单份文档 8 MiB；本地 PNG、JPEG、GIF、WebP 经类型校验后展示。
- 不直接解析 PDF、DOCX；可先通过既有工具转换成 Markdown，再作为资料阅读。Mermaid、特殊 HTML 等内容保留原文，未承诺交互渲染。
- 工作区路径来自 DSH 已注册且通过 STG 校验的工作区；浏览器不能传任意磁盘根。新建/导入的绝对路径仅来自宿主原生文件夹选择器。拒绝路径穿越、链接越界、隐藏目录和不安全应用目录访问。
- 新建/导入目前需要 DSH 桌面版的原生文件夹选择能力；纯 Web 宿主可使用已经登记的有效 STG 学习空间，未实现 Web 目录浏览器。
- 没有可用模型时，文档阅读、编辑、作答保存和历史仍可使用；导师生成需要 DSH 配置可用模型。
- 代码复制与公式编辑复用 STG Desk 的原文保留逻辑，未修改区块保留原 Markdown。

## 开发与验收

需要 Node.js 24+。

```text
npm ci
npm test
npm run build
npm run test:native
npm pack
```

浏览器隔离验收使用真实文件后端和虚构课程，需要本机 Electron：

```powershell
$env:STG_ELECTRON_PATH = 'C:\path\to\electron.exe'
npm run test:browser
```

验收脚本只使用临时数据目录和自己启动的进程，不连接真实学习目录或修改用户 DSH profile。`test:native` 使用本地官方 DSH 组合验证插件接口；模型发送与纯本地检查在记录中分开列出。

源码边界：`src/host/` 负责文件与学习数据；`src/workbench/` 负责界面；`src/native.js` 负责真实会话；`src/bridge.js` 负责鉴权路由；`src/editor/` 负责同源富文本编辑；`vendor/stg/` 保留 MIT 学习解析核心。构建生成 `lib/client.js` 和第三方许可清单。

验证证据见 [VERIFICATION.md](VERIFICATION.md)，接口与集成说明见 `docs/`。

## 许可与参考

新增实现采用 [MIT](LICENSE)。STG Desk 编辑器和解析核心保留来源提交与 MIT 许可。打包浏览器依赖的许可保存在 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 和 `licenses/`。

StudyMate、WorkDSH、思源用于架构和交互研究；未复制思源 AGPL 主项目实现。
