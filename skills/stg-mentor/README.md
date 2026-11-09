# Steps2Great-skill

[![内容质检](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml/badge.svg)](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/代码-MIT-blue.svg)](./LICENSE)
[![Docs: CC BY 4.0](https://img.shields.io/badge/文档-CC%20BY%204.0-lightgrey.svg)](./LICENSE-DOCS)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-SKILL.md-662df8.svg)](https://code.claude.com/docs/en/skills)

**把支持 Agent Skills 的 AI，变成你的一对一导师。**

装进你的 AI 客户端之后，那个 AI 就不再是问答题机器，而是**按一份教学协议陪你学**：
先了解需求，每块内容先用场景和一个小问题导入，再讲解、分轮练习、批改复评，把进度写进你工作区的文件里。

**它不是软件、不是课程、不是网站**，就是一份简洁的 `SKILL.md`；**它不教任何特定学科** —— 它规定的是**怎么教**。

**v1.2.0：同步最新教学闭环与独立学习项目。** 保留开始阶段的 grill-me 式需求澄清；每轮完整教学单独留档，批改与修订复评按当前轮闭环，模块掌握条与本次技能清单分别更新。见[完整学习流程](./references/docs/learning-workflow.md)。

> **两条边界先说清**：① 需要**支持 Agent Skills**、且该 AI **能读写本地文件、愿意遵循协议**的客户端，它的安装、账号与费用由提供方决定，与本项目无关；② 下面的仿真与回归测试是**框架自测**，**不证明真人学习收益**。

> **详版**（完整理念 / 四种安装细节 / 语言策略 / 完整对话案例 / 测试证据 / 结构维护 / FAQ 全文）：[`docs/readme-details.md`](./docs/readme-details.md)

[English](./README.en.md) | 简体中文

**怎么走**

[开始](#开始) · [完整流程](./references/docs/learning-workflow.md) · [学习视图](#学习视图两层进度分开) · [核心规则](#核心规则摘要) · [安装](#安装) · [资料教学](#用你自己的资料教) · [两个壳](#同一套协议的两个壳) · [常见问题](#常见问题) · [深入](#想深入看这里)

---

## 开始

**别急着往下读，也不用背规则条数。** 装好之后跟 AI 说一句话就够了：

> **「我想学 Python，目标是能自己处理 Excel，每天 30 分钟。」**

它会先读已有规则与进度，**了解需求**，再用具体场景带出一个低门槛问题，让你**在聊天里**思考回答；
首次摸底按证据出 **2–8 题**，够定起点就停，随后排前 3–5 课。**每块新内容都先对话导入。**

之后你的日常只有两个动作：**回答当前问题**，和**说一句「完成了」**。

> **不必来回开文件**：可以在聊天里回答，由导师把你的原答**原文整理**进回答文档；也可以自己直接写文档。
> 需要排查加载时，复述硬规则条数（当前 12 条）只能当初步线索 —— 更可靠的是看客户端的加载记录、文件读取轨迹与实际产出。

---

## 学习视图：两层进度分开

每块内容先给一个两层视图，再开始讲。**模块掌握条**看的是「这个模块里正式掌握了几个知识单元」，**本次小目标清单**看的是「这一小块你具体学会了什么」——两者分开算，清单全勾，条也可以不动。

这是一个**虚构示意**（不是真实测评记录），展示小目标完成后的样子：

**Python 列表 · 模块掌握**

已掌握 **1/4** 个知识单元

![模块掌握 1/4](./docs/assets/module-progress-compact-1-of-4.svg)

**小目标｜追加一件商品**

- [x] 说清 **`append`** 是把单个元素加到列表末尾
- [x] 区分**追加**与**覆盖**，知道原有元素会保留
- [x] 独立调用 **`append`** 新增商品，并核对列表变化

> **小目标完成**｜你现在能给已有清单追加商品，不用重写整张清单。可以停在这里。

*依据：模块—认识列表最终复评；技能—本次正式评估。添加单元尚未全部掌握，模块条保持 1/4。*

三条规矩值得记住：

- **证据达标才勾**：导入中的表现只记「初步观察」；**提示下答对会标明提示，独立技能项不勾**；说「懂了」或导师代答后的复述不算证据。
- **及时具体反馈**：每个实质进展先说你刚独立做对了什么、产生了什么效果，再纠错或给下一步。
- **有自然停点**：小目标完成就说清「你现在能……」，不顺手加下一块必做题。

口径全文见 [小目标进度](./references/协议/06_小目标进度.md) 与 [对话导入](./references/协议/05_对话导入.md)。

---

## 核心规则摘要

| 规则 | 一句话 |
|---|---|
| **三维评估** | ① 概念理解 / ② 逻辑正确 / ③ 规范表达，**适用维度全部通过**才推进；不适用的标 `— 不适用` |
| **一轮 1–3 题** | 按题型成本折算；本轮通过才发下一轮，**绝不一次把一课的题全发** |
| **重读再评估** | 你说「完成了」→ **重新读回答文档**，禁止凭对话记忆判定；聊天提交先原文追加再重读 |
| **小改大导** | 笔误/语法直接改并讲透三段式；概念、逻辑错走 Socratic，让你自己推 |
| **裁决口诀** | 说错了 → ①；想错了 → ②；写错了 → ③ |
| **卡住就换解释** | 缩小当前问题；**提示后复述不计独立掌握**，后续再独立验证 |
| **状态只在三处** | 🚦 交接状态 / 📊 掌握表 / ⏳ 待办表，不重复记 |
| **规则改覆盖层** | 要改规则 → 写 `我的学习/我的规则.md`（优先级最高），**不改框架** |

> 完整 12 条见 [`SKILL.md`](./SKILL.md)；裁决口诀的由来、代改三段式与费曼法约束见 [详细说明](./docs/readme-details.md#它到底立了什么规矩)。

---

## 安装

四种装法任选，细节见 [详细说明 § 安装](./docs/readme-details.md#装它安装细节)。

```bash
# ① 用 skills CLI（一条命令，生态标准做法；需要本机有 Node.js / npm）
npx skills add wildcat430524/Steps2Great-skill
```

```powershell
# ② 手动 clone 成个人 skill（最省事，所有项目都能用）
git clone https://github.com/wildcat430524/Steps2Great-skill.git "$env:USERPROFILE\.claude\skills\steps2great-skill"
```

- **③ 装进某个项目**（团队共用）：把仓库 clone 到 `.claude/skills/steps2great-skill`。
- **④ 当 npm 包 / git 依赖分发**：`package.json` 已配好 `files` 白名单。

> **各客户端读哪个目录、怎么触发并不统一**（有的支持斜杠命令，有的只靠 `description` 自动路由），
> **本项目不承诺某个通用调用写法** —— 以**你客户端官方文档**为准。
> **Node 是可选的**：脚本只是「初始化 / 自检 / 更新」的加分项；没有它也能说「帮我起个头」，让 AI 手工建目录。

---

## 生成独立学习项目（可选）

默认的轻量工作区把框架留在 skill 里，学生目录只有 `我的学习/` 与 `资料/`。
如果你想把教学框架**跟着学习目录走**，可以让它生成一个**与 StepsToGreat 同源**的独立项目：

```bash
node scripts/init-workspace.mjs --root <你的学习目录> --standalone
```

生成内容包括 `AGENTS.md`、中英文协议、学科包、模板、教程、各客户端入口、资料检索工具、状态校验器与回归夹具。
项目文件直接由上游同步，**保留原目录结构与相对链接**；之后移动目录或改用别的 AI 工具时，读取目录内的本地入口即可，**不再依赖原来的 skill 安装目录**。
新档案来自空模板，**不复制任何人的学习记录**；视频、宣传资产与本项目的 skill 开发工具不包含在生成目录里。

- **省略 `--standalone`** 仍生成原来的轻量目录（框架留在 skill 中）。
- **已有轻量目录**也可以加这个参数补齐框架，**已有文件不会被覆盖**。
- 独立项目的 `update.mjs --root <目录>` **只更新有指纹记录、且未被手工修改**的框架文件；档案、规则、课程回答和资料保留。加 `--check` 只预览、不写。

> 教学核心与 StepsToGreat 同源：摸底、路线、场景导入、分轮练习、三维复评、落档、多学科切换、模块进度与小目标清单都保留。

---

## 用你自己的资料教

把资料丢进工作区的 `资料/`，然后说：

> **「资料我放在 `资料/` 里了，先只用第 1 章教我。」**

AI 会**定位后完整读该小节**（含条件与例外），按**实际内容**教，并注明出自哪份文件的哪一节（允许查证，不允许编书单）。
扫描件、加密文件等**读不了的内容不算依据**，导师会明确停下说明缺口；没有现成教材时，依据**可核实的一手来源**讲解，并把来源写进教学文档。

| 格式 | 支持度 |
|---|---|
| `.md` `.txt` | ✅ 最好 |
| `.pdf`（有文字层） | ✅ 好（**扫描件需 OCR**） |
| `.docx` `.pptx` | ⚠️ 一般，建议另存为 `.md` |
| 图片 / 视频 | ⚠️ 看工具；视频请给字幕或笔记 |

> 可选的只读检索工具（`scripts/materials.mjs`）提供目录、搜索与完整小节读取；没有它也能用文件读取工具或 `rg`。
> 方法与引用规范：[`references/docs/material-retrieval.md`](./references/docs/material-retrieval.md)

---

## 同一套协议的两个壳

| | [StepsToGreat](https://github.com/wildcat430524/StepsToGreat)（文件夹版） | **本仓库**（skill 版） |
|---|---|---|
| 形态 | 一个文件夹，打开它就是导师 | 一份 Agent Skill，装进支持 skills 的客户端 |
| 安装 | **无需项目运行环境**，另需 AI 工具 | 一行 `npx skills add wildcat430524/Steps2Great-skill` |
| 触发 | `AGENTS.md` + 自动生成的工具跳板文件 | frontmatter `description`（中英双语触发词） |
| 内容来源 | 仓库本体 | `SKILL.md` **手写**；`references/` 由同步脚本**从上游镜像** |
| 数据 | 你的文件夹 | 你的工作区 —— 都是纯 Markdown，**可以互相接续** |

两边是**同一套教学协议**：上游改了规则，本仓库跑一次 `node _build/sync-from-upstream.mjs` 同步过来 —— `references/` 不手抄，所以不漂移；
但 **`SKILL.md` 是手写入口，不在镜像映射里，需要单独维护，不会自动更新**。

> 客户端不支持 Agent Skills？直接用 [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) 的文件夹形态。

---

## 常见问题

**怎么确认 skill 真的装上了？**
让它复述 `SKILL.md` 里「硬规则」有几条 —— 正确回答是 **12 条**，但这**只是初步排查**：
答对不等于已加载，答错也不等于一定没加载。更可靠的是结合客户端的加载记录、实际文件读取与行为产出核对。

**我的客户端不加载 skill 怎么办？**
先确认它是否支持 Agent Skills；确实不支持，就用 [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) 的文件夹形态 —— **同一套协议**。

**换 AI 客户端会丢记录吗？**
不会。全部数据是普通 Markdown，在你的工作区 `我的学习/` 里。换客户端 → 打开同一个工作区 → 说「继续」。

**要花钱吗？**
协议本身免费（MIT + CC BY 4.0）。**客户端是否免费、额度多少、要不要账号由各厂商决定，与本项目无关**，且会变动。

**能把一整本书丢进去学吗？**
能，这是最常用的用法。把书放进工作区 `资料/`，说「我要学透它」。

**怎么改我自己的学习规则？**
写进工作区的 `我的学习/我的规则.md` —— **覆盖层，优先级最高**，与框架默认分开保存，也不用改框架。

> 更多（资料上传、判错怎么办、多学科、状态校验、学科包）：[FAQ 全文](./docs/readme-details.md#常见问题全文)

---

## 想深入看这里

| 想了解 | 看这里 |
|---|---|
| **README 的展开版**（理念 / 安装细节 / 语言策略 / 案例 / FAQ 全文） | [`docs/readme-details.md`](./docs/readme-details.md) |
| **AI 到底读什么**（精简入口契约与主循环） | [`SKILL.md`](./SKILL.md) |
| 教学规则的唯一出处 | [`references/协议/`](./references/协议/) |
| 每块内容怎么导入 / 模块条与清单口径 | [`references/协议/05_对话导入.md`](./references/协议/05_对话导入.md)｜[`references/协议/06_小目标进度.md`](./references/协议/06_小目标进度.md) |
| 哪些错误算哪一维（裁决口诀） | [`references/协议/00_导师协议.md`](./references/协议/00_导师协议.md) §3 |
| 什么时候该写哪个文件 / 状态机与 12 条不变式 | [`references/协议/03_落档事件表.md`](./references/协议/03_落档事件表.md)｜[`references/协议/04_状态机.md`](./references/协议/04_状态机.md) |
| 各学科的三维口径怎么定 | [`references/学科包/README.md`](./references/学科包/README.md) |
| 5 分钟跑通全流程的演示 | [`references/示例/演示学科/README.md`](./references/示例/演示学科/README.md) |
| **为什么这些规矩是实测出来的** | [`references/docs/simulations/`](./references/docs/simulations/)｜[`tests/weak-model-report.md`](./tests/weak-model-report.md)｜[`references/docs/E2E-RUN-REPORT.md`](./references/docs/E2E-RUN-REPORT.md) |
| 行为评测怎么跑、边界在哪 | [`references/docs/behavior-evaluation.md`](./references/docs/behavior-evaluation.md) |
| 语言策略、仓库结构、开发与自检 | [详细说明](./docs/readme-details.md#语言策略只用中文还是只用英文) |
| 客户端兼容矩阵（核验时间 2026-09，会随厂商改版） | [`references/docs/AGENT-COMPAT.md`](./references/docs/AGENT-COMPAT.md) |
| 术语定义 / 改什么该提 PR | [`references/CONTEXT.md`](./references/CONTEXT.md)｜[`CONTRIBUTING.md`](./CONTRIBUTING.md) |

---

## 许可

- **代码 / 脚本**：MIT —— 见 [`LICENSE`](./LICENSE)
- **文档 / 协议**：CC BY 4.0 —— 见 [`LICENSE-DOCS`](./LICENSE-DOCS)

从上游镜像来的内容遵循上游许可。署名建议：

```
基于 StepsToGreat（https://github.com/wildcat430524/StepsToGreat）
与 Steps2Great-skill（https://github.com/wildcat430524/Steps2Great-skill），
采用 CC BY 4.0 许可，原作者已授权。
```

---

**现在开始** → 装好之后，说：

```
我想学 <X>，目标是 <Y>，每天能投入 <Z> 分钟。
```
