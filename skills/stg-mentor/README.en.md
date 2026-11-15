# Steps2Great-skill

[简体中文](./README.md) · English

**Add a one-on-one tutor to the AI client you already use.**

Bring a learning goal and start with one small question. The tutor teaches from your answers, gives feedback, and saves your original work and next step in the workspace. Open the same folder to pick up where you left off.

[Install](#install) · [Try a prompt](#start) · [See a tutoring exchange](#core-rules-at-a-glance) · [Get the folder version](https://github.com/wildcat430524/StepsToGreat/blob/main/README.en.md)

[![Content check](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml/badge.svg)](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml)
[![Code MIT](https://img.shields.io/badge/code-MIT-blue.svg)](./LICENSE)
[![Docs CC BY 4.0](https://img.shields.io/badge/docs-CC%20BY%204.0-lightgrey.svg)](./LICENSE-DOCS)

## Install

Use a client that supports **Agent Skills** and local file access. Run this from your study folder with Node.js 22.20 or later, then select the client you use.

```sh
npx skills add wildcat430524/Steps2Great-skill
```

Add `-g` to install across projects. For manual setup, place this repository’s folder containing `SKILL.md` where your client discovers skills. [Manual setup and troubleshooting](./docs/readme-details.en.md#install-details) · [skills CLI](https://github.com/vercel-labs/skills#install-a-skill)

## Start

Open a study folder and tell the tutor what you actually want to learn today. If your client does not select the skill automatically, use its skill picker or invocation mechanism to select `steps2great-skill` and send the same request.

```text
Use Steps2Great as my tutor. I know Python loops and get confused by negative indices.
I want to read list slices. I have 15 minutes today.
```

With a clear goal, you can start right away. Once you’re doing formal practice, you can answer in chat and the tutor will save your original answer to a file and re-read it before grading. Say “continue” next time you open the same folder. [Full learning workflow](./references/en/docs/learning-workflow.en.md)

## Core rules at a glance

**Example exchange**

> **Tutor**　There are three items in `["milk", "bread", "eggs"]`. What would `items[-2:]` keep?
>
> **Learner**　Bread. −2 is the second item from the end.
>
> **Tutor**　You found the starting point. `-2` points to bread. The blank after the colon tells the slice to go all the way to the end. What comes after bread?

The tutor sets 1–3 questions per formal round and reviews all your answers together. It can fix and explain a typo. For a misconception, it gives a focused hint so you can work through it. You advance after passing the applicable checks for concept, logic, and expression. The files keep both your original work and revisions. [Skill entry point](./SKILL.md) · [Five-minute walkthrough](./references/示例/演示学科/README.md)

## Learning view: two separate layers

Module progress counts units that have passed final assessment. The checklist records the skills you have demonstrated for this specific goal.

**Python lists · 1 of 4 units mastered (illustration)**

![One out of four Python list units mastered](./docs/assets/module-progress-compact-1-of-4.svg)

**Small goal · Read slices with negative indices**

- [x] Find the starting position of a negative index
- [ ] Independently predict the result of a slice with no end index

When you finish a goal, the tutor names what you can now do and gives you a place to stop. [Progress rules](./references/en/协议/06_小目标进度.en.md)

## Generate a standalone project (optional)

A lightweight workspace keeps the protocol in the installed Skill. To take the protocol with your study records, run this in the Skill repository, substituting your own study folder.

```sh
node scripts/init-workspace.mjs --root "./my-study" --standalone
```

A standalone project includes `AGENTS.md`, tutorials, the protocol, and templates. You can open it in any AI client with local file access. Initialization preserves existing student files. Preview framework updates with `update.mjs --root <study-folder> --check`. [Workspace and update guide](./docs/readme-details.en.md)

## Teach from your own material

Put your notes or textbook in the workspace’s `资料/` folder and name the section you want to study. The tutor reads that section and its exceptions, then cites the file and section as it teaches. Scanned PDFs may need OCR first. If you have no course material, give the tutor a verifiable primary source. [Retrieval and citation guide](./references/docs/material-retrieval.md)

## Two shells, one protocol

| How you want to study | Where to start |
| --- | --- |
| Call the tutor from a client that supports Agent Skills | **Steps2Great-skill** (this repository) |
| Open a portable Markdown folder | [StepsToGreat](https://github.com/wildcat430524/StepsToGreat/blob/main/README.en.md) |
| Use a workspace for reading, answers, and tutor chat in DSH Desktop | [DSH learning workbench](https://github.com/wildcat430524/dsh-stg-learning) |

The folder and Skill share the teaching protocol. You can move saved Markdown study records with the workspace.

## FAQ

- **How do I check whether the Skill loaded?** Look for `steps2great-skill` in your client, then try a learning request and check which protocol and study files it reads.
- **How do I keep my preferences?** Ask the tutor to save a rule such as “one question at a time” under `我的学习/我的规则.md` in your workspace.
- **Does it cost money?** The protocol is free to use. Your client or model provider sets its own prices. [Full FAQ](./docs/readme-details.en.md#full-faq)

## Verification and evaluation

Regression tests cover workspace setup, state validation, re-reading answers, grading a whole round, and preserving original work. Simulations exercise the tutoring workflow. Measuring learning gains requires studies with real learners. [Evaluation method](./references/docs/behavior-evaluation.md) · [Simulations](./references/docs/simulations/) · [End-to-end report](./references/docs/E2E-RUN-REPORT.md)

## Going deeper

- **Explore setup and design.** [Expanded guide](./docs/readme-details.en.md) · [Client compatibility](./references/docs/AGENT-COMPAT.md) · [State machine](./references/en/协议/04_状态机.en.md)
- **See how the tutor works.** [SKILL.md](./SKILL.md) · [Tutor protocol](./references/en/协议/00_导师协议.en.md) · [Subject packs](./references/en/学科包/README.en.md)
- **Contribute from experience.** Try a round with your own material. Star the project if it helps, or share a reproducible case if grading, citation, or resuming a lesson breaks. [Contributing guide](./CONTRIBUTING.md) · [Report an issue](https://github.com/wildcat430524/Steps2Great-skill/issues)

## License

Code is [MIT](./LICENSE). The protocol and teaching material are [CC BY 4.0](./LICENSE-DOCS). Please credit StepsToGreat and Steps2Great-skill when redistributing the material.
