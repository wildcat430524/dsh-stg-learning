# Steps2Great-skill

简体中文 · [English](./README.en.md)

**把一对一导师装进你常用的 AI 客户端。**

带着一个学习目标来，用一个小问题开始。导师根据你的回答讲解、出题和批改，把原答、反馈和下一步留在工作区里。下次打开原工作区，就能接着学。

[安装](#安装) · [试一句](#开始) · [看一轮示例](#核心规则摘要) · [下载文件夹版](https://github.com/wildcat430524/StepsToGreat)

[![内容质检](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml/badge.svg)](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml)
[![代码 MIT](https://img.shields.io/badge/代码-MIT-blue.svg)](./LICENSE)
[![文档 CC BY 4.0](https://img.shields.io/badge/文档-CC%20BY%204.0-lightgrey.svg)](./LICENSE-DOCS)

## 安装

准备一个支持 **Agent Skills** 与本地文件读写的 AI 客户端。用 Node.js 22.20 或更新版本，在学习目录中运行下方命令，然后选择你实际使用的客户端。

```sh
npx skills add wildcat430524/Steps2Great-skill
```

想在多个项目里使用时，可以给命令加 `-g`。手动安装时，把含 `SKILL.md` 的仓库放到客户端扫描的 Skill 目录。[手动安装与排查](./docs/readme-details.md#装它安装细节) · [skills CLI](https://github.com/vercel-labs/skills#install-a-skill)

## 开始

打开一个学习目录，发一句你今天真想学的事。自动匹配失败时，可以按客户端支持的方式显式选择 `steps2great-skill`，再发同一句。

```text
用 Steps2Great 做我的导师。我会 Python 循环，看到负数索引就容易混淆。
我想学会读列表切片，今天有 15 分钟。
```

目标清楚就直接开始。正式学习后，你可以在聊天里答题，由导师将原文保存到回答文档后重读评估。下次在这个目录里说「继续」。[完整学习流程](./references/docs/learning-workflow.md)

## 核心规则摘要

**一轮对话示意**

> **导师**　有三件商品 `["牛奶", "面包", "鸡蛋"]`。只看 `items[-2:]`，你觉得会留下哪几件？
>
> **学生**　面包。-2 是倒数第二件。
>
> **导师**　你找对了起点，`-2` 指向面包。冒号后面空着，表示从起点一直取到末尾。沿着清单往后走，面包之后还有哪一件？

正式练习每轮出 1–3 题。导师一次评完本轮，笔误可以解释后修正，概念或推导卡住时给一个针对性的提示，让你接着完成。概念、逻辑、表达的适用维度都通过后才推进。原答和修订都留在文件里。[Skill 入口](./SKILL.md) · [五分钟演示](./references/示例/演示学科/README.md)

## 学习视图：两层进度分开

模块进度记录通过最终评估的知识单元。本次清单记录当前小目标里已经用作答证据验证的技能。

**Python 列表 · 已掌握 1/4 个单元（示意）**

![Python 列表已掌握 4 个单元中的 1 个](./docs/assets/module-progress-compact-1-of-4.svg)

**小目标｜读懂负数切片**

- [x] 找到负数索引对应的起点
- [ ] 独立预测省略终点时的切片结果

小目标完成时，导师会告诉你现在能做什么并给出自然停点。[进度规则](./references/协议/06_小目标进度.md)

## 生成独立学习项目（可选）

轻量工作区把教学协议留在 Skill 里。想把协议也带走，可以在 Skill 仓库中运行以下命令，将路径换成你的学习目录。

```sh
node scripts/init-workspace.mjs --root "./我的学习项目" --standalone
```

独立项目带上 `AGENTS.md`、教程、协议与模板，之后可用支持本地读写的 AI 客户端打开。初始化保留已有学生文件。更新前可用 `update.mjs --root <学习目录> --check` 预览将更新的框架文件。[工作区与更新说明](./docs/readme-details.md)

## 用你自己的资料教

把讲义或教材放进工作区的 `资料/`，再指定要学的章节。导师会先读对应小节及其中的例外，再教并注明文件和小节。扫描版 PDF 建议先做 OCR。没有教材时，可以给导师一个可核对的一手来源。[检索与引用方法](./references/docs/material-retrieval.md)

## 同一套协议的两个壳

| 你怎么学 | 入口 |
| --- | --- |
| 想在支持 Agent Skills 的客户端里调用导师 | **Steps2Great-skill**（本仓库） |
| 想用一个可带走的 Markdown 文件夹 | [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) |
| 想在 DSH 桌面里使用阅读、作答和老师对话界面 | [DSH 学习工作台](https://github.com/wildcat430524/dsh-stg-learning) |

文件夹版和 Skill 版共用教学协议。已保存的 Markdown 学习记录可以随工作区迁移。

## 常见问题

- **Skill 加载了吗？** 在客户端确认 `steps2great-skill` 已发现，再试发一个学习请求，查看实际读到的规范和学习文件。
- **怎样固定学习偏好？** 例如「每次只出一道题」，可以让导师保存到工作区的 `我的学习/我的规则.md`。
- **项目收费吗？** 协议可免费使用，模型与客户端费用按所用服务的计费方式计算。[更多问题](./docs/readme-details.md#常见问题全文)

## 验证与评测

回归测试覆盖工作区初始化、状态校验、重读回答、按轮评估和保留原答。仿真记录用于验证导师流程，真人学习效果仍需学习者测试。[行为评测方法](./references/docs/behavior-evaluation.md) · [仿真案例](./references/docs/simulations/) · [端到端报告](./references/docs/E2E-RUN-REPORT.md)

## 想深入看这里

- **了解安装与设计。** [完整说明](./docs/readme-details.md) · [客户端兼容性](./references/docs/AGENT-COMPAT.md) · [状态机](./references/协议/04_状态机.md)
- **了解教学协议。** [SKILL.md](./SKILL.md) · [导师协议](./references/协议/00_导师协议.md) · [学科包](./references/学科包/README.md)
- **参与贡献。** 用自己的资料走一轮。觉得有用可以点 Star，遇到漏判、引用问题或无法续学时，欢迎提交可复现的例子。[贡献指南](./CONTRIBUTING.md) · [反馈问题](https://github.com/wildcat430524/Steps2Great-skill/issues)

## 许可

代码采用 [MIT](./LICENSE)，协议和教学文档采用 [CC BY 4.0](./LICENSE-DOCS)。转载时请保留 StepsToGreat 与 Steps2Great-skill 的署名和出处。
