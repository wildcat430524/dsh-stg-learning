# Steps2Great-skill

[![Content check](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml/badge.svg)](https://github.com/wildcat430524/Steps2Great-skill/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](./LICENSE)
[![Docs: CC BY 4.0](https://img.shields.io/badge/docs-CC%20BY%204.0-lightgrey.svg)](./LICENSE-DOCS)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-SKILL.md-662df8.svg)](https://code.claude.com/docs/en/skills)

**Turn an AI that supports Agent Skills into your one-on-one tutor.**

Installed into your AI client, it stops being a Q&A machine and starts **tutoring you under a protocol**:
it establishes your needs, opens each new block with a situation and one small question, then explains,
practises in rounds, grades your work, and writes progress into your workspace files.

**It is not an app, a course, or a website** — just a compact `SKILL.md`. And **it teaches no particular subject**: it defines **how to teach**.

**v1.2.0: synchronize the latest teaching loop and standalone learning projects.** Retain grill-me-style needs clarification at the start, preserve each round's complete teaching guide, close grading and revision within the current round, and update module mastery separately from the current skill checklist. See the [full learning workflow](./references/en/docs/learning-workflow.en.md).

> **Two boundaries up front**: ① you need a client that **supports Agent Skills**, with an AI that can **read and write local files and is willing to follow the protocol** — its installation, accounts, and costs are decided by its provider, not this project; ② the simulations and regression tests below are **framework self-testing** and **do not prove real learner gains**.
>
> **In depth** (full rationale, all four install paths, language strategy, complete walkthrough, test evidence, layout, full FAQ): [`docs/readme-details.en.md`](./docs/readme-details.en.md)

[简体中文](./README.md) | English

**Jump to**

[Start](#start) · [Full workflow](./references/en/docs/learning-workflow.en.md) · [Learning view](#learning-view-two-separate-layers) · [Core rules](#core-rules-at-a-glance) · [Install](#install) · [Your own material](#teach-from-your-own-material) · [Two shells](#two-shells-one-protocol) · [FAQ](#faq) · [Deeper](#going-deeper)

---

## Start

**Don't read further yet, and don't memorise any rule count.** Once installed, one sentence is enough:

> **"I want to learn Python so I can process Excel files myself. 30 minutes a day."**

It reads the existing rules and progress, **understands your needs**, then opens with a concrete situation and one easy
question for you to think about **in chat**. Initial placement uses **2–8 probes**, stopping once the starting point is
clear, followed by the first 3–5 lessons. **Every new block starts conversationally.**

From then on you only ever do two things: **answer the current question**, and **say "done"**.

> **No need to keep opening files**: answer in chat and the tutor files your original words **unchanged** into the answer document; writing the document directly also works.
> To troubleshoot loading, reciting the hard-rule count (currently 12) is only an initial clue — a more reliable check is the client's loading records, file-read traces, and actual output.

---

## Learning view: two separate layers

Every block opens with a two-layer view before teaching starts. The **module mastery bar** tracks how many knowledge units
are formally mastered in the module; the **current small goal** tracks what you specifically learned in this block —
calculated separately, so the list can be fully ticked while the bar stays put.

This is a **fictional illustration** (not a real assessment record) showing the state after a small goal is complete:

**Python lists · module mastery**

**1/4** knowledge units mastered

![Module mastery 1/4](./docs/assets/module-progress-compact-1-of-4.svg)

**Small goal｜Append an item to an existing list**

- [x] Explain that **`append`** adds a single element to the end of a list
- [x] Tell **appending** apart from **overwriting**, knowing existing elements stay
- [x] Independently call **`append`** to add an item and verify the list changed

> **Small goal complete** | You can now append an item to an existing list without rewriting it. You may stop here.

*Evidence: module - meet-lists final re-assessment; skills - current formal assessments. The adding unit is not yet fully mastered, so module progress remains 1/4.*

Three rules worth remembering:

- **Tick only from evidence**: introduction performance is recorded as "preliminary observation"; **answering correctly under a hint is labelled, and independent skill items stay unticked**; "I get it" and parroting the tutor's answer are not evidence.
- **Prompt, specific feedback**: each substantive step first names what you just did independently and what it changed, before correcting or handing over the next step.
- **A natural stopping point**: completing a small goal says plainly "you can now …", without attaching the next block's mandatory questions.

Full criteria: [Small-goal progress](./references/协议/06_小目标进度.md) and [Conversational introduction](./references/协议/05_对话导入.md).

---

## Core rules at a glance

| Rule | In one line |
|---|---|
| **Three dimensions** | ① concept / ② logic / ③ form — advance only when **all applicable dimensions pass**; n/a ones are marked `— n/a` |
| **1–3 questions per round** | Scaled by question cost; the next round comes only after this one passes — **never the whole lesson's questions at once** |
| **Re-read before assessing** | "Done" → **the answer file is re-read**; judging from conversation memory is forbidden; chat submissions are appended unchanged first |
| **Fix small, guide big** | Typos/syntax are fixed for you with the three-part explanation; conceptual or logical errors go Socratic so you derive them |
| **Verdict mnemonic** | said it wrong → ①; thought it wrong → ②; wrote it wrong → ③ |
| **Stuck? Change the explanation** | Shrink the current question; **parroting after a hint does not count as independent mastery** — verify independently later |
| **State in three places** | 🚦 handoff status / 📊 mastery table / ⏳ to-do table — never duplicated |
| **Rules change in the overlay** | Change rules in `我的学习/我的规则.md` (highest priority), **never the framework** |

> All 12 are in [`SKILL.md`](./SKILL.md); the mnemonic's origin, the three-part fix, and the Feynman limits are in the [details](./docs/readme-details.en.md#the-rules-it-enforces).

---

## Install

Four options, any one works — details in [details § Install](./docs/readme-details.en.md#install-details).

```bash
# 1. Via the skills CLI (one command — the ecosystem-standard way; needs Node.js / npm)
npx skills add wildcat430524/Steps2Great-skill
```

```powershell
# 2. Clone it manually as a personal skill (available in every project)
git clone https://github.com/wildcat430524/Steps2Great-skill.git "$env:USERPROFILE\.claude\skills\steps2great-skill"
```

- **3. Project skill** (travels with the repo): clone into `.claude/skills/steps2great-skill`.
- **4. Distribute as an npm package or git dependency**: the `files` allowlist in `package.json` is already set.

> **Which directory each client reads, and how it triggers, varies** (some offer slash commands, others only route via `description`) —
> **this project does not promise any universal invocation syntax**; follow **your client's official documentation**.
> **Node is optional**: the scripts are only a bonus for init / self-check / updates; without them you can still say "set me up".

---

## Generate a standalone project (optional)

The default lightweight workspace keeps the framework inside the skill, so the student folder holds only `我的学习/` and `资料/`.
If you'd rather have the teaching framework **travel with the learning folder**, generate a **standalone project sourced from StepsToGreat**:

```bash
node scripts/init-workspace.mjs --root <learning-folder> --standalone
```

This includes the local `AGENTS.md`, bilingual protocols, subject packs, templates, guides, client entry files, material-retrieval tools, the state validator and the regression fixtures.
Project files come straight from upstream, so the **original directory structure and relative links are preserved**; afterwards the folder can move, or be opened by a different AI tool, by reading its own local entry point — with **no dependency on the original skill installation**.
The profile starts from an empty template and **no one's learner history is copied**; videos, promotional assets, and this repo's skill-development tooling are excluded.

- **Omitting `--standalone`** still produces the original lightweight workspace (framework stays in the skill).
- **An existing lightweight workspace** can be expanded with the same flag; **existing files are never overwritten**.
- A standalone project's `update.mjs --root <folder>` replaces **only framework files that are fingerprinted and unmodified by hand**; profiles, rules, lesson answers, and materials are preserved. Adding `--check` previews changes without writing.

> The teaching core is the same as StepsToGreat: placement, routing, conversational introduction, round-by-round practice,
> three-dimension re-assessment, filing, multi-subject switching, the module bar and the small-goal list all carry over.

---

## Teach from your own material

Drop the material into the workspace `资料/` folder and say:

> **"My material is in `资料/` — teach me just chapter 1 for now."**

The AI **locates the section and reads it in full** (including conditions and exceptions), teaches from the **actual content**,
and cites which file and which section, so you can verify it — no fabricated reading lists.
Scans, encrypted files, and anything **it cannot read is not evidence** — the tutor stops and states the gap.
With no textbook supplied, it works from **verifiable primary sources** and records them in the lesson document.

| Format | Support |
|---|---|
| `.md` `.txt` | ✅ Best |
| `.pdf` (text layer) | ✅ Good (**scans need OCR**) |
| `.docx` `.pptx` | ⚠️ Mediocre — save as `.md` instead |
| Images / video | ⚠️ Tool-dependent; for video, supply subtitles or notes |

> An optional read-only CLI (`scripts/materials.mjs`) lists, searches, and reads full sections; without it, plain file reads or `rg` work the same way.
> Method and citation rules: [`references/docs/material-retrieval.md`](./references/docs/material-retrieval.md)

---

## Two shells, one protocol

| | [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) (folder form) | **This repo** (skill form) |
|---|---|---|
| Form | A folder — open it and it's your tutor | An Agent Skill installed into a skills-capable client |
| Install | **No project runtime needed**; an AI client is still required | One line: `npx skills add wildcat430524/Steps2Great-skill` |
| Trigger | `AGENTS.md` + auto-generated per-tool pointers | Frontmatter `description` (bilingual trigger words) |
| Content source | The repo itself | `SKILL.md` is **hand-written**; `references/` is **mirrored from upstream** by the sync script |
| Data | Your folder | Your workspace — both plain Markdown, **mutually resumable** |

Both are **the same teaching protocol**: change a rule upstream and run `node _build/sync-from-upstream.mjs` here — `references/`
is never hand-copied, so nothing drifts. But **`SKILL.md` is a hand-written entry point**, not in the mirror mapping: it needs
**separate maintenance** and **does not update itself**.

> Client doesn't support Agent Skills? Use the [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) folder form instead.

---

## FAQ

**How do I know the skill actually loaded?**
Ask it to recite the hard-rule count from `SKILL.md` — the correct answer is **12**, but this is **only an initial diagnostic**:
a correct answer doesn't prove it loaded, and a wrong one doesn't prove it didn't. A more reliable check combines the client's
loading records, actual file reads, and behaviour.

**My client doesn't load skills. What now?**
First check whether it supports Agent Skills; if it genuinely doesn't, use the [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) folder form — **the same protocol**.

**Will switching AI clients lose my records?**
No. Everything is plain Markdown in your workspace `我的学习/`. Switch client → open the same workspace → say "continue".

**Does it cost anything?**
The protocol itself is free (MIT + CC BY 4.0). **Whether a client is free, how much quota it gives you, and whether it needs an account are decided by each vendor, are unrelated to this project, and change over time.**

**Can I throw a whole book at it?**
Yes — that's the most common use. Drop the book into the workspace `资料/` and say "I want to master this".

**How do I change my own study rules?**
Write them into the workspace `我的学习/我的规则.md` — the **overlay, highest priority**, stored separately from the framework defaults, with no framework edits needed.

> More (uploads, wrong grading, several subjects, state validation, subject packs): [full FAQ](./docs/readme-details.en.md#full-faq)

---

## Going deeper

| To learn about | Read |
|---|---|
| **The expanded README** (rationale / install details / language strategy / walkthrough / full FAQ) | [`docs/readme-details.en.md`](./docs/readme-details.en.md) |
| **What the AI actually reads** (the compact contract and main loop) | [`SKILL.md`](./SKILL.md) |
| The single source of truth for teaching rules | [`references/协议/`](./references/协议/) |
| How each block is introduced / bar and list criteria | [`references/协议/05_对话导入.md`](./references/协议/05_对话导入.md)｜[`references/协议/06_小目标进度.md`](./references/协议/06_小目标进度.md) |
| Which error belongs to which dimension (mnemonic) | [`references/协议/00_导师协议.md`](./references/协议/00_导师协议.md) §3 |
| When to write which file / state machine and 12 invariants | [`references/协议/03_落档事件表.md`](./references/协议/03_落档事件表.md)｜[`references/协议/04_状态机.md`](./references/协议/04_状态机.md) |
| How each subject defines its three dimensions | [`references/学科包/README.md`](./references/学科包/README.md) |
| A 5-minute end-to-end demo | [`references/示例/演示学科/README.md`](./references/示例/演示学科/README.md) |
| **Why these rules were measured, not guessed** | [`references/docs/simulations/`](./references/docs/simulations/)｜[`tests/weak-model-report.md`](./tests/weak-model-report.md)｜[`references/docs/E2E-RUN-REPORT.md`](./references/docs/E2E-RUN-REPORT.md) |
| How the behaviour evaluation runs and where its limits are | [`references/docs/behavior-evaluation.md`](./references/docs/behavior-evaluation.md) |
| Language strategy, layout, development and self-checks | [details](./docs/readme-details.en.md#language-strategy-one-language-only-or-both) |
| Client compatibility matrix (verified 2026-09; ages as vendors change) | [`references/docs/AGENT-COMPAT.md`](./references/docs/AGENT-COMPAT.md) |
| Glossary / what to PR where | [`references/CONTEXT.md`](./references/CONTEXT.md)｜[`CONTRIBUTING.md`](./CONTRIBUTING.md) |

---

## License

- **Code / scripts**: MIT — see [`LICENSE`](./LICENSE)
- **Docs / protocol**: CC BY 4.0 — see [`LICENSE-DOCS`](./LICENSE-DOCS)

Mirrored content follows upstream licensing. Suggested attribution:

```
Based on StepsToGreat (https://github.com/wildcat430524/StepsToGreat)
and Steps2Great-skill (https://github.com/wildcat430524/Steps2Great-skill),
licensed CC BY 4.0 with the original author's permission.
```

---

**Now start** → once installed, say:

```
I want to learn <X>, my goal is <Y>, and I can give it <Z> minutes a day.
```
