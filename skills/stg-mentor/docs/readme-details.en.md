# Steps2Great-skill · Details

> This is the expanded companion to the [README](../README.en.md): full rationale, installation details, language strategy,
> the complete dialogue walkthrough, test evidence, repository layout, and the full FAQ.
> **To install and start quickly**, the [README](../README.en.md) is enough; this file explains every *why*.
> 中文: [readme-details.md](./readme-details.md)

## Contents

[Why a skill version](#why-a-skill-version-at-all) ·
[Install details](#install-details) ·
[Not learning anything](#not-learning-anything--just-need-to-think-one-thing-through) ·
[Who it's for](#who-its-for-who-it-isnt) ·
[How it works](#how-it-works) ·
[Two progress layers](#two-progress-layers-the-module-bar-and-this-blocks-skill-list) ·
[Learning and progress illustration](#learning-and-progress-illustration-fictional--not-a-real-assessment-record) ·
[The rules it enforces](#the-rules-it-enforces) ·
[A complete dialogue walkthrough](#a-complete-dialogue-walkthrough) ·
[How these rules were verified](#how-these-rules-were-verified) ·
[Language strategy](#language-strategy-one-language-only-or-both) ·
[Repository layout](#repository-layout) ·
[Adaptive updates](#adaptive-updates) ·
[Development and self-checks](#development-and-self-checks) ·
[Full FAQ](#full-faq) ·
[Going deeper](#going-deeper) ·
[License](#license)

---

## Why a skill version at all

The previous generation, [StepsToGreat](https://github.com/wildcat430524/StepsToGreat), verified workflow feasibility through simulations; real learning outcomes still need evaluation:
a folder plus an `AGENTS.md` file, and any AI that can read a folder becomes a tutor.

But it has three hard limits — **all of them caused by the "folder" form, not by the protocol**:

| Upstream limit | How the skill version solves it |
|---|---|
| Rules must **travel with the repo** — a new project means dropping the folder in again | Install once into the skills directory; **every project and every session can trigger it** |
| Triggering depends on **whether the tool reads `AGENTS.md`** — upstream relies on generated pointer files across many tools, each maintained by hand | Triggering rides the **frontmatter `description`** (bilingual trigger words), which every Agent Skills client reads |
| Content **drifts when hand-copied** — change a rule, forget a copy | `references/` is a **mirrored build artifact**; change upstream, run the sync script, CI verifies consistency |
| Nobody checks **whether the protocol was followed** | A state validator (12 invariants) + state and sync regression cases + CI on every push |

### How the two divide the work

| | [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) | **Steps2Great-skill** (this repo) |
|---|---|---|
| Form | A folder (open it and it is your tutor) | An Agent Skill (install into any client) |
| Trigger | `AGENTS.md` + upstream's generated pointer files | Frontmatter `description` (bilingual triggers) |
| Content source | The repo itself | **Mirrors** upstream + a hand-written `SKILL.md` |
| Best for | "One folder carries everything"; reading all the design docs | "Install once, use everywhere"; distributing / sharing with a team |
| Your data | Your folder | Your workspace — **both plain Markdown, mutually resumable** |

> **They are two shells around one protocol.** Change a teaching rule upstream, run
> `node _build/sync-from-upstream.mjs` here, and `references/` follows — nothing hand-copied, so nothing drifts.
> But **`SKILL.md` is a hand-written entry point** and is *not* in the mirror mapping: when the rules change it must be
> **maintained separately** and does not update itself.

### Versus pasting a prompt into your AI

| | Paste a prompt | Steps2Great-skill |
|---|---|---|
| **Auto-triggered** | ❌ You must remember to paste it | ✅ Say "I want to learn X" and it has a chance to load |
| Rule length | Whatever you'll paste (usually a few hundred words) | **Read on demand** — a compact contract + the relevant references, fetched as needed |
| Drift | Versions everywhere | Single source of truth + mirror script + CI |
| State | In the conversation, gone when it closes | In your workspace files — **survives switching clients** |
| Verifiable | ❌ | ✅ 12 invariants + state and sync regression cases |

---

## Install details

### 1. Via the skills CLI (one command — the ecosystem-standard way)

```bash
npx skills add wildcat430524/Steps2Great-skill
```

It asks which client to install for (Claude Code / Cursor / Codex / Gemini / Cline / Roo / Trae / Zed …)
and drops it in the right skills directory. Common flags:

```bash
npx skills add wildcat430524/Steps2Great-skill -g              # global (every project)
npx skills add wildcat430524/Steps2Great-skill -a claude-code  # target one client
npx skills list                                                # what's installed
npx skills update                                              # update everything
```

### 2. Clone it manually as a personal skill (available in every project)

Clone the repo into your skills directory as `steps2great-skill` (matching the frontmatter `name`), keeping `SKILL.md` and its resources together:

```bash
# Claude Code / compatible Agent Skills clients
git clone https://github.com/wildcat430524/Steps2Great-skill.git ~/.claude/skills/steps2great-skill
```

Windows PowerShell:

```powershell
git clone https://github.com/wildcat430524/Steps2Great-skill.git "$env:USERPROFILE\.claude\skills\steps2great-skill"
```

**Which directory each client reads** — the table below lists **common conventions that change as clients evolve**;
before installing, check **your client's official documentation** rather than treating this as a permanent guarantee:

| Client | User-level (common) | Project-level (common) |
|---|---|---|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| OpenAI Codex | `~/.codex/skills/` | `.codex/skills/` |
| Cursor | `~/.cursor/skills/` or `~/.agents/skills/` | `.cursor/skills/` or `.agents/skills/` |
| Gemini / Antigravity | `~/.gemini/config/skills/` | `.agents/skills/` |
| Generic (shared by several clients) | `~/.agents/skills/` | `.agents/skills/` |

> Cursor also **reads Claude and Codex directories** for compatibility — so one install into `~/.claude/skills/` may be
> enough for it too. To share one directory across clients, use `~/.agents/skills/` (or symlink it into each client's directory).
> `-g` installs user-level, omitting it installs project-level — again, follow your client's docs.

**How to trigger it**: enable or invoke the skill using whatever method that client supports, or simply say "I want to learn X"
and let the model decide whether to load it. Invocation styles differ between clients (some offer slash commands; others only
route via `description`), and **this project does not promise any universal invocation syntax** — check your client's docs.

### 3. Project skill (travels with the repo)

```bash
mkdir -p .claude/skills && git clone https://github.com/wildcat430524/Steps2Great-skill.git .claude/skills/steps2great-skill
```

### 4. Bundle it into a plugin / distribute it

`package.json` ships a `files` allowlist (`SKILL.md` + `references/` + `templates/` + `scripts/`),
so it works as an npm package or a git dependency. Other skills can reach it via `skill steps2great-skill`.

> **Node is optional.** The scripts exist for workspace init, self-check, and updates.
> You can also just say "I want to learn X, set me up" and let the AI create the folders by hand.

### How to confirm it really loaded

Start with the client's loading records, file-read traces, and actual output.
Making it recite the hard-rule count (currently 12) is **only an initial diagnostic** — a correct answer doesn't prove it
loaded, and no answer doesn't prove it didn't. Check the output item by item rather than trusting self-reports;
see the [full FAQ](#full-faq).

---

## Not learning anything — just need to think one thing through?

The same probing machinery can be pointed at a decision — hand it a plan or a vague requirement and it keeps asking until you run out of things to say.

> ⚠️ **Note**: this is **an adopted way of asking** (applying the protocol's "confirm before acting / ask everything at once /
> only ask what can be asked now" to decisions), **not a separate built-in mode** of this framework — `SKILL.md` and
> `references/协议/` define no standalone "interrogation" flow.
> It **does not bypass any teaching assessment**: once you actually start learning, the three-dimension assessment and
> round-by-round pacing apply as usual.

| Rule | What it says |
|---|---|
| **Only ask what can be asked now** | Every question rests on decisions that are **already settled**; anything depending on another open question waits for a later round |
| **Whole round at once + a recommended answer** | Every question in the current frontier is listed and numbered, each with **its recommended answer** — you just say "agreed" or "change it" |
| **Your answers grow the next round** | Settled decisions push the frontier outward and unblock questions that couldn't be asked before; round after round, until **nothing is left open** |
| **It looks up facts, you make the calls** | Anything findable in the files is not put to you; only "it's your call" questions reach you |
| **Nothing happens until you confirm** | You restate the understanding, both sides agree, and only then does it start |

**Capture as you go**: the conclusions can be written straight into two documents —

① **Decision records**: one entry = context / options / what was decided / why → `references/docs/adr/`;
② a **glossary**: one word, one meaning across the project → `references/CONTEXT.md`.

The point is plain: **three months from now, you can still remember why you decided it that way.**

> Versus a placement test: a **placement test** fixes where you start (questions, no score); an **interrogation** fixes a decision (no questions, no right answer — it's your call).

---

## Who it's for, who it isn't

**Say it plainly, so you don't install it for nothing.**

| ✅ Good fit | ❌ Not a fit |
|---|---|
| You already use a client that supports Agent Skills | Your client **doesn't support skills at all** (use the [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) folder form instead) |
| Self-studying a skill but keep stalling | You want ready-made videos / textbooks — **this project provides no content** |
| You need someone who checks your work | You just want ask-and-answer |
| Your goal is concrete (an exam, a project, a gap) | You have no goal and want to browse |
| You'll actually **write answers** (typed or on paper) | You only want to listen passively |
| You're in it for weeks to years | You want one fact looked up |
| You have your own material (textbooks, past papers, notes) | You expect the AI to invent a curriculum from memory |

> **One line**: if you want someone to set questions, mark them, and make you practise — this is for you.
> If you want *content*, go find a course. This project is the **person watching you**.

---

## How it works

```mermaid
flowchart TD
    A["① You say 'I want to learn X'"] --> B["② Client decides<br/>whether to load SKILL.md via description"]
    B --> C["③ Takeover: read my rules → read 🚦 status → read protocol"]
    C --> D{"Profile still blank?"}
    D -->|Yes| E["④ Needs → situated question → placement 2–8 probes → route"]
    D -->|No| F["④ Resume from the lesson 🚦 points at"]
    E --> P["Introduce every new block in chat"]
    F --> R{"Current block already introduced?"}
    R -->|Yes| G
    R -->|No| P
    P --> G["⑤ Prepare block documents + current round (1–3 questions)"]
    G --> H["⑥ You answer in 01_学生回答.md<br/>(chat answers are appended unchanged)"]
    H --> I["⑦ You say 'done'"]
    I --> J["⑧ Re-read the file (never from memory)<br/>→ three-dimension assessment, all questions at once"]
    J --> K{"All applicable dimensions ✅ ?"}
    K -->|No| L["Small: fixed directly + three-part explanation<br/>Big: Socratic guidance, you derive it"]
    L --> I
    K -->|Yes| M["⑨ Append round results + concrete feedback<br/>Update profile only when the whole lesson passes"]
    M --> N{"All conditions for this small goal met?"}
    N -->|No| G
    N -->|Yes| O["⑩ Show the skill checklist and close: you can stop here"]
    O -->|Student continues and advancement conditions are met| P
```

**Across the whole thing you say two sentences**: the opening one, and "**done**" each round.

### Every lesson produces two files

**These are the vehicle of the teaching model** — each lesson creates two Markdown files in your workspace:

```
我的学习/学科/Python/03-for循环/
├── 01_教学引导.md    ← tutor writes: two progress layers → this block's actual problem → method and example → necessary pitfalls → this round's practice
└── 01_学生回答.md    ← you write (or the tutor files your chat answers unchanged): this round's answers; two placeholders at the end for the tutor
```

| File | Who writes | What's in it |
|---|---|---|
| **`01_教学引导.md`** | The tutor | Module mastery bar → current skill list → current step → the actual problem → method and example → necessary pitfalls → this round's practice |
| **`01_学生回答.md`** | **You** (or the tutor, filing your words unchanged) | This round's questions + your answers; **two placeholders at the end**: `## 最终复评结果` (per-question 3-D table), `## 正确答案与解析` (three-part explanation) |

**Two key conventions**:

| Convention | What it means |
|---|---|
| **The answer file is the only evidence** | Chat answers are filed unchanged and re-read before assessment. Small goals use round evidence; lesson mastery uses the final re-assessment, not a claim of understanding or a tutor's assertion |
| **Appended round by round, never all at once** | The answer file starts with **only round 1** (1–3 questions); after that round passes on all applicable dimensions, the tutor **appends** the next |

> 💡 **Why two files instead of one conversation**: a conversation closes and is gone; files remain.
> Three months on, when you want to review "what did I get wrong about for loops",
> you open `01_学生回答.md` and see the original answer, the reason, and the fix — **instead of scrolling chat history**.

---

## Two progress layers: the module bar and this block's skill list

They are **calculated separately and never converted into each other** (full criteria: [`references/协议/06_小目标进度.md`](../references/协议/06_小目标进度.md)):

| Layer | What it shows | Derived from |
|---|---|---|
| **Module mastery bar** | **formally mastered knowledge units / units defined by the course route** (a 200px graphic filled to `200*K/T`, with readable counts outside the image) | The course route + the 📊 mastery table + the lesson's final re-assessment, checked independently |
| **Current skill list** | Usually **2–4 concrete skills; a tiny goal may have just one** | This block's formal assessment evidence, ticked one by one |

- The list can be **fully ticked while the module bar does not move at all** — finishing a small goal is not the same as mastering the lesson or the module.
- When a module's scope or the evidence is unclear, it says "module progress to be determined / to be checked" — it **never invents a denominator or a percentage**.
- **Tick only from evidence**: introduction performance is recorded as "preliminary observation"; **answering correctly under a hint is labelled, and independent skill items stay unticked**; "I get it" and parroting the tutor's answer are not evidence.
- The list **excludes process items** like "finished the exercise" or "passed validation" — formal verification is a background condition.
- Every substantive step gets **immediate, concrete feedback**: what you just did independently and what it changed. A vague "good job" is not feedback.
- When every skill is met and the block's formal rounds have passed, the tutor **says the block is done and you can stop here**, without attaching the next block's questions. The module bar is shown honestly — usually unchanged.
- It never pretends a module is mastered: if the module's closing verification is outstanding, that unit doesn't count and the bar stays short.
- **The two-layer view is consistent in three places**: the conversation, `01_教学引导.md`, and `01_学生回答.md`. The top view is a replaceable snapshot — **your original answers and past assessments are never overwritten**.

---

## Learning and progress illustration (fictional — not a real assessment record)

The block below is a **purely illustrative layout** showing what the two layers and a skill list look like. It is **not** any real student's assessment result and is **not** evidence of learning outcomes.

> Tutor: You're heading out. The shopping list says bread and eggs. At the door you remember milk, so you add a line at the bottom. Are the original two items still there?
>
> Student: Yes.
>
> Tutor: Right — adding doesn't erase what was there. Now we learn exactly one thing: appending one item with a single line of code.

Start from everyday experience; when you're stuck it shrinks to a smaller step; later the hints come off and you verify independently. **What appears below is the state after this small goal passes assessment — not a tick immediately after answering the introduction question.**

**Module: Python lists**

`██░░░░░░░░` **1/4 knowledge units mastered**

**Current small goal: append one item to an existing shopping list**

- [x] Explain that `append` adds a single element to the end of a list
- [x] Distinguish appending from overwriting, knowing existing elements stay
- [x] Independently call `append` to add an item and verify the list changed

> Current step: this small goal is complete — you can stop here. Basis: the "meet lists" lesson's final re-assessment + this block's skill assessment.

Note especially: **the list is fully ticked, and the module bar is still 1/4.** Batch adding within the "adding" unit hasn't been taught, and the remaining units aren't mastered — so the result must not be described as "the module is finished".

(The criteria live in [`references/协议/06_小目标进度.md`](../references/协议/06_小目标进度.md); its §7 example is likewise declared fictional.)

---

## The rules it enforces

**In one line**: three dimensions (① conceptual understanding / ② logical correctness / ③ formal correctness) — **all applicable dimensions must be ✅** before anything counts as mastered, and nothing advances until then.
Partial mastery (any ⚠️) and non-mastery (any ❌) both fail. When a dimension doesn't apply to a question it is marked `— n/a` and doesn't count either way.

The load-bearing ones (all 12 are in [`SKILL.md`](../SKILL.md)):

| Rule | What it says |
|---|---|
| **1–3 questions per round** | Scaled by question cost: light items up to 3, a full algorithm or essay question only 1–2. **Never the whole lesson's questions at once** |
| **Re-read before assessing** | "Done" → **the answer file must be re-read**; judging from conversation memory is forbidden; chat submissions are appended unchanged first, then re-read |
| **Assess the whole round at once** | Every question of the round, no drip-feeding; questions that weren't changed are still explicitly called correct |
| **Direct fix for small problems** | Typos / single-point syntax / missing symbols are fixed in the file so the student doesn't waste a round — but always with the three-part explanation |
| **Socratic for big problems** | Conceptual or logical errors are guided: minimal hint first, the student derives it |
| **Stuck? Change the explanation** | Shrink the current question, and explain directly if needed; **parroting after a hint does not count as independent mastery** — verify independently later |
| **Feynman as a diagnostic** | Mandatory once at the end of a big module, at most once per lesson, dropped entirely if the student says no |
| **State lives in three places** | 🚦 handoff status / 📊 mastery table / ⏳ to-do table. No writing one progress fact in five places |
| **Rules change in the overlay** | Student wants a rule changed → `我的学习/我的规则.md` (highest priority), **never the framework** |

### The verdict mnemonic for the three dimensions

For any error, ask in order — this is the project's single most useful rule:

| Order | Question | Dimension |
|---|---|---|
| 1 | Is what the student **said itself wrong** (concept, term, fact)? | **① Conceptual understanding** |
| 2 | Concepts fine, but **the reasoning chain is broken / doesn't hold**? | **② Logical correctness** |
| 3 | Everything above fine, it just **doesn't match the subject's formal rules**? | **③ Formal correctness** |

**Mnemonic: said it wrong → ①; thought it wrong → ②; wrote it wrong → ③.**
Hits two dimensions at once → **take the earlier one** (① > ② > ③). **Feynman questions score ① only**; the other two are marked `— n/a`.

> This mnemonic was not invented at a desk: **8 subject simulations** found that **6 subjects shared one core symptom** —
> "does this error belong to ② or ③?" was unanswerable, which made **verdicts irreproducible** (two tutors mark the
> same paper differently). So the general rule went into `references/协议/00_导师协议.md` §3.

### Direct fix vs. Socratic guidance

| Case | Handling |
|---|---|
| **Small** (typo-level, single-point convention, missing symbol/keyword, minor format) | **Edit the answer file directly** so the student doesn't burn a round — but **always explain it face to face** |
| **Big** (conceptual error, broken logic/derivation) | Socratic: give a question or the minimal hint; the student derives the fix |

**Direct fix = edit the file *and* explain it properly. Both.** "Fixed." alone is a failing response.
The three-part form is: **① your original answer → ② what's wrong, and why (the principle) → ③ what I changed it to**.

### Feynman: can't explain it = don't actually understand it

| Ordinary question | Feynman question |
|---|---|
| Can be bluffed with a formula, a template, or familiarity | You must organise the language yourself; nothing to bluff with |
| Correct ≠ understood | **Can't explain it = definitely not understood** (almost never misjudged) |
| Tests "can you do it" | Tests "**do you actually understand it**" |

**Frequency is adaptive, so you won't be asked constantly**: mandatory once at the end of a big module; worth it for
abstract or confusable concepts; skipped for purely procedural ones; **at most once per lesson, never two rounds in a row**;
student says "I'd rather not — just test me" → respected, ordinary questions instead.

---

## A complete dialogue walkthrough

> ⚠️ **Note**: this is a **reconstruction/simulation** of a full study run, derived rule by rule from the protocol —
> illustrative in content, but **not** a verbatim recording and **not** evidence of real learner gains.
> This project collects no user conversations.
> It shows what the dialogue looks like **once the protocol is running**.
>
> Scenario: a Python beginner whose goal is "write scripts to process Excel", from first load to lesson 3 passing, spanning a week.

### Day 1 — first load

**You**:
```
I want to learn Python so I can process Excel files myself. 30 minutes a day.
```

**AI** (the client loaded the skill from its `description`):
```
I've read the protocol and your workspace — the profile is still blank, so we start with requirements.

Four questions (answer them in one go):
1. Why Python? → to automate Excel at work
2. Any prior exposure? → none at all
3. When do you need it by? → this quarter, to automate the reports
4. How much time can you reliably give it per day? → 30 minutes, maybe more at weekends

Then I'll walk you through one small situation first, and run a placement test (2–8 questions max, spread over several rounds — I won't dump them all at once).
```

**You**:
```
1 work 2 none 3 this quarter 4 half an hour a day
```

**AI**:
```
Here's one small thing first: you have 5 rows of sales records and need quantity × unit price for each.
Just tell me this: 3 items at 12 each — what does that row come to?
```

**You**:
```
36
```

**AI**:
```
Right — and that step is exactly what the formula will be built on later.
(I'm only noting this as preliminary observation; it isn't mastery. Let's move into the formal flow.)

Placement, round 1 — 2 questions:

**Q1**: What's the difference between `print("hi")` and `x = 1`?

**Q2**: Write one line that adds `3` and `5` and prints the result.

(Hint: if you don't remember the syntax for Q2, write the part you do know.)
```

> 💡 **Note**: the placement test also obeys "1–3 questions per round" — no 8-question dump.
> The little scenario above is the **conversational introduction**: solve one small thing first, then move into systematic explanation.

### Placement conclusion (middle steps skipped)

**AI**:
```
✅ Placement: your starting point is L1 (complete beginner).

   - Already have: opening Excel, knowing what a cell is
   - To cover: variables, loops, file I/O
   - Starting from: lesson 1, "Variables and data types"
   - Roughly 8 lessons to "a script that batch-edits Excel"

Written to 我的学习/学科/Python/00-摸底测试.md, and the first 5 lessons are laid out.
Start lesson 1?
```

### Lesson 3 — a typical round

**AI** (ships the lesson):
```
**Next: #3 for loops and range()** (you'll need this to process every row of Excel)

### 📁 Where the files are
- Teaching guide: 我的学习/学科/Python/03-for循环/01_教学引导.md
- Answer document: 我的学习/学科/Python/03-for循环/01_学生回答.md

**Module: Python loops**
`██░░░░░░░░` **1/5 knowledge units mastered**
(This module's five units are loop concepts, for with range, while with break, continue, and nested loops; loop concepts were already mastered.)

**Current small goal: generate a run of consecutive numbers with range()**
- [ ] Explain range()'s half-open interval
- [ ] Independently write a loop that prints 1 to 5

### ✅ Your task
Round 1, 2 questions — answer in the document (or answer in chat and I'll file it unchanged), then say "done".
```

**You** (answering inside `01_学生回答.md`):
```python
# Round 1 · Q1: which numbers does range(3) print, and why?
# A: it prints 0 1 2, because range starts at 0

# Round 1 · Q2: write code that prints 1 to 5
for i in range(5):
    print(i)
```

**You**:
```
done
```

**AI**:
```
I re-read your answer file (2 questions this round):

| # | Conceptual | Logical | Formal | Verdict |
|---|-----------|---------|--------|---------|
| 1 | ✅       | — n/a   | — n/a  | Pass    |
| 2 | ✅       | ❌      | ✅     | Fix     |

## 1️⃣ Q2: the loop range is wrong

**Your original answer**
for i in range(5):
    print(i)

**What's wrong**
- range(5) yields 0,1,2,3,4 — starts at 0, ends at 4 (**exclusive of 5**)
- The task asks for 1 to 5, so you print 0 to 4: **one 5 short, one 0 extra**
- This is Python's "half-open interval" convention, the classic beginner trap

**What I changed it to**
for i in range(1, 6):
    print(i)

Q1 is right — "range starts at 0" is the key insight here.
Fix Q2 and tell me, and we'll go to round 2.
```

> 💡 Three protocol rules on display: **① every question in the round assessed at once** (no drip-feeding) |
> **② a small problem fixed directly** (this one is a *writing* problem) | **③ the three-part explanation**.
> Note that "Q1 is right" cannot be skipped either — otherwise the student reads silence as a problem.

### Big problems go Socratic (not direct-fixed)

Round 2 asks for "print the even numbers from 1 to 10". You wrote:

```python
for i in range(1, 11):
    print(i)
```

**AI**:
```
## 1️⃣ Q3: the even-number test is missing

This one is different from last time — Q2 was a **writing** problem (I fixed it for you),
but this is a **logic** problem, and you need to work it out yourself.

Your code prints every number from 1 to 10, but the task only wants the **even** ones.

Don't write code yet. Answer me this first:

> **If you had to say out loud what makes a number even, what would you say?**

(If you're stuck, hint: what operator in Python gives you a remainder?)
```

**You**:
```
remainder when divided by 2 is 0
```

**AI**:
```
Exactly. So what does that look like as code?
(Hint: `%` for remainder, `==` for equality, `if` to choose — use all three.)
```

**You**:
```python
for i in range(1, 11):
    if i % 2 == 0:
        print(i)
```

**AI**:
```
✅ That's it. You derived it yourself — which sticks far better than being told. Both questions this round pass.
```

> 💡 **This is the direct-fix / Socratic boundary**: a writing error → fixed for you (saving a round); a logic error → yours to solve (that *is* the learning).

### Filing the state + sending the next lesson

**AI**:
```
#3 for loops and range() closed ✅

Updated:
- 01_学生回答.md → final re-assessment + correct answers and explanation
- 00-学习档案.md → 📊 mastery table gains "for loops and range()" + 🚦 handoff status

**This small goal is complete**: you can now generate a run of consecutive numbers with range(),
and explain why it is "start inclusive, end exclusive".
The module bar is **unchanged** this round (other units aren't taught yet) — you can stop here.

**Next: #4 while loops and break** (some cases can't be written with for — e.g. "keep reading until the file ends")

### ✅ Your task
Complete round 1 (2 questions), then say "done".
```

### Day 7 — one Feynman question (the loops module is finished)

**AI**:
```
The loops module is done. This round has a single question, and it isn't an ordinary one — it's a **Feynman question**.

You may not use these words: <loop>, <iterate>, <iteration>, <range>

**Explain, in words your mum would understand: why does a computer need to "do the same thing repeatedly"?**

3–5 sentences is enough. This isn't an exam — failing to explain it just means there's a gap here, which is exactly what we're looking for.
```

**You**:
```
It's like laundry. You wouldn't hand-wash each item one at a time — you throw the whole pile in the
machine, set the program, and it turns by itself. A computer is the same: instead of writing the same
line a hundred times, you tell it "for all of these things, do the same action each time".
```

**AI**:
```
✅ That's clear — better than I expected.

**What's good**: the washing-machine analogy is very precise — it captures two things at once:
① you avoid repetitive labour ② you must first "set the program" (that's what goes in the loop body)

**One place to sharpen**: you said "it turns by itself" — but a computer is more rigid than a washing machine:
it has **no idea how many turns to make**, you must state the count up front. That is exactly what your next lesson (while) solves.

Filed to the profile: `for loops and range()` remark = ✅ and explainable Feynman-style
```

> 💡 Three moves in that Feynman feedback: **① name what was good** (not a hollow "nice work") →
> **② name one place to sharpen, and bridge it to the next lesson** → **③ file the Feynman evidence into the profile**
> (stronger proof of mastery than merely answering questions correctly).

### Day 10 — back after a week, in a different client

**You** (new session, a different Agent Skills client):
```
continue
```

**AI**:
```
I read 🚦 handoff status in 我的学习/00-学习档案.md:

- Subject: **Python** (goal: batch-process Excel with scripts)
- Current lesson: **#4 while loops and break**
- Progress: lesson published, answer file empty, waiting on you
- Open: ⏳ spaced review #1 (3 knowledge points have hit the trigger)
- First step on takeover: do the spaced review, then #4

Want to do that review question now? (1 question, covering variables / data types / for loops)
```

> 💡 **This is what "state on disk + same protocol under a new shell" buys you**: a different client, a week later,
> and the AI still knows exactly where you are — because the state is **in files** and the protocol is **in the skill**.

### What the walkthrough demonstrates

| Mechanism | Where it appears |
|---|---|
| Requirements → conversational introduction → placement → starting point | Day 1 |
| **1–3 questions per round** | Placement and every lesson |
| Three-dimension assessment (all round questions at once; n/a dimensions marked) | Lesson 3 |
| **Direct fix + three-part explanation** | Q2 (writing error) |
| **Socratic guidance, you derive it** | Q3 (logic error) |
| **Two layers kept separate**: list ticked + explicit stopping point, module bar unchanged | Lesson 3 filing |
| **Feynman question (big module, single question)** | Day 7 |
| Explicitly saying unchanged questions are fine | "Q1 is right" |
| Two files per lesson | Every lesson |
| Filing the state (answer doc + 3 profile places) | After each lesson passes |
| **Survives a client switch / a week away** | Day 10 |

> Want to check these really are in the protocol? See [`SKILL.md`](../SKILL.md) (12 hard rules, question pacing, direct-fix protocol)
> and [`references/协议/00_导师协议.md`](../references/协议/00_导师协议.md) (assessment rules / remediation loop / Feynman method).
> **The dialogue is the protocol's output, not decoration.**
>
> One more time: **the whole passage above is a simulation/illustration** of the protocol's shape; it is not evidence of real learning outcomes.

---

## How these rules were verified

**This section is where this repo differs most in character from upstream.** Upstream answers "is the protocol good?";
this repo must additionally answer: **after packaging, is it still good?**

Four kinds of evidence, all in the repo (all **framework self-testing and scenario simulation**, not real learner gains):

| # | Method | What it caught | Report |
|---|---|---|---|
| **1** | **8 subject simulations** — an AI plays tutor through full teaching dialogues (real errors, repeated probing, frustration), then defects are extracted from the transcripts | All 8 subjects **needed patching**; **6 shared one core symptom** (② vs ③ unassignable) → hence the verdict mnemonic | [`references/docs/simulations/`](../references/docs/simulations/) |
| **2** | **Weak models as probes** — deliberately run at the lowest reasoning effort (`low`/`off`), because strong models **guess** their way past unclear protocol and hide the defect | Protocol itself **12/12 × 4 models**; the packaging layer had **5 real defects** (3 validator + template dead links + mirror overwriting hand fixes) | [`tests/weak-model-report.md`](../tests/weak-model-report.md) |
| **3** | **End-to-end run** — an AI walks the whole thing: first use → placement → roadmap → lesson 1 → three rounds → lesson closed → state filed | 1 protocol gap + **1 template dead-link defect that would hit every user** + 2 validator false positives | [`references/docs/E2E-RUN-REPORT.md`](../references/docs/E2E-RUN-REPORT.md) |
| **4** | **State validator** — 12 invariants checking whether your profile is self-consistent | Catches "marked mastered with no re-assessment evidence", "advancing before the previous lesson passed", "two re-assessment sections in one file" | [`references/协议/04_状态机.md`](../references/协议/04_状态机.md) |

### Three numbers behind "adding rules ≠ adding value"

| Number | Meaning |
|---|---|
| **All 8 subjects needed patching** | The three-dimension **mechanism** is complete, but the **criteria** are described per dimension rather than per error |
| **133 suggestions → only 5 adopted** | The reports' value is **evidence**; rules take only what causes "criteria fighting". **7 suggestions were explicitly rejected**, with reasons written down |
| **12 invariants + state and sync regression cases** | "A real failure first, then a rule" — every invariant traces back to the test that exposed it |

### The one that matters most: a validator must not punish honesty

The weak-model test found 3 validator defects, **all the same pattern** — the more honestly the model wrote
(noting "this file doesn't exist yet", putting evidence and conclusion in one cell), the more likely it was failed.

> **The criterion should be "does a human reading this model's writing find it correct?", not "did it guess a format I never documented?".**

Every one of those pits is now pinned by a regression case:

| Case | What it pins |
|---|---|
| `T1`–`T8` (8) | The validator's real defects + reverse cases (relaxing must not over-relax) + "a protocol version above what's supported must be rejected" |
| `S1`–`S6` (6) | **One mirror sync must not wipe the fixes made on the skill side** (hit once; now guarded by fingerprint assertions); and stale content must fail `--check` without writing |

Run them:

```bash
npm test        # state and sync regressions + material tools + behavior evaluation
```

> ⚠️ **Boundary**: all of the above is **engineering self-testing and scenario simulation**. It shows that the checkers
> judge correctly and the protocol is written clearly — it **cannot** show that your learning will improve. Real learning
> benefit still needs human pre/post testing, and this project currently has **no such evidence**.

---

## Language strategy: one language only, or both?

Every skill has to answer this. This repo answers it **by layer**:

| Layer | Choice | Why |
|---|---|---|
| **Frontmatter `description`** | **Bilingual** | It sits in context **every single turn** and is the main thing the model routes on. One language means half your possible users never trigger it. Both sets of trigger words live here |
| **`SKILL.md` body** | **Chinese only** | The body is *rules*, and one copy is enough. Two copies means every rule change must land twice — guaranteed drift. The protocol also relies on established Chinese terms (代改, 三段式, 落档, 可豁免笔误) that lose precision when translated. **Actual tutoring still uses the student's language** |
| **`references/`** | Chinese primary + `references/en/` mirrors | English readers need the full reference; those English versions are already maintained upstream, so mirroring costs nothing extra |
| **README** | Both languages | Front door, cheap, high value |

**In one line: bilingual at the trigger layer, single-language at the execution layer.**
Doing otherwise fails in one of two familiar ways — bilingual bodies drift (one copy updated, the other forgotten),
or a single-language body never triggers for half the audience.

> **A real bug (hence `verify-skill-load`)**: if the frontmatter `description` is a bare scalar containing `: `,
> a strict YAML parser fails with `Nested mappings are not allowed` — and **the skill silently fails to load**,
> while the plain text looks perfectly fine. Both `scripts/check.mjs` and `_build/verify-skill-load.mjs` now catch it.
> See [CONTRIBUTING.md](../CONTRIBUTING.md).

> Using this repo as a template for your own skill? Copy the table.

---

## Repository layout

```
Steps2Great-skill/
├── SKILL.md                    ← the contract and main loop (hand-written entry; not mirrored; maintained separately when rules change)
├── references/                 ← read on demand (74 files, including 18 English mirrors)
│   ├── 协议/                   ← the single source of truth for teaching rules (incl. state machine, introduction, small-goal progress)
│   ├── 学科包/                 ← programming / language / humanities / sciences / exams — each defines its own dimension ③
│   ├── 模板/                   ← blank templates for the profile, roadmap, lesson guide, student answers
│   ├── docs/simulations/       ← 8 subject simulation reports (these rules are measured, not guessed)
│   ├── docs/weak-model/        ← weak-model conformance report
│   ├── docs/adr/               ← 10 architecture decision records (the reasoning behind every tradeoff)
│   ├── 示例/                   ← a 5-minute end-to-end demo
│   ├── 教程/                   ← human-facing setup and design notes
│   ├── en/                     ← English mirrors
│   └── CONTEXT.md              ← glossary (one word, one meaning)
├── templates/workspace/        ← scaffolding copied into the student's workspace (hand-written, workspace-relative links)
├── scripts/
│   ├── init-workspace.mjs      ← build the workspace skeleton (never overwrites)
│   ├── update.mjs              ← adaptive update (never touches your learning records)
│   ├── validate-state.mjs      ← state validator (12 invariants; mirrored upstream with path adaptation)
│   ├── materials.mjs           ← material retrieval (read-only: list / search / full section)
│   ├── behavior-eval.mjs       ← tutor-behaviour evaluation harness
│   └── check.mjs               ← repo self-check (frontmatter / links / encoding / mirror drift)
├── tests/
│   ├── regression-state.mjs    ← validator regressions (8 cases)
│   ├── regression-sync.mjs     ← mirror-sync regressions (6 cases)
│   ├── materials.test.mjs      ← material-retrieval regressions
│   ├── behavior-eval.test.mjs  ← behaviour-harness regressions
│   └── weak-model-report.md    ← the full weak-model-as-probe report
├── evals/behavior/             ← 12 behaviour scenarios and the fixture adapter
├── _build/
│   ├── sync-from-upstream.mjs  ← mirrors framework files from StepsToGreat (link rewriting + fingerprint guard)
│   ├── verify-skill-load.mjs   ← loader view: a real YAML parser validates SKILL.md
│   └── score-workspace.mjs     ← six-dimension scorer for a tested workspace
└── .github/workflows/check.yml ← CI: loader + regressions + self-check + workspace + student-asset assertion
```

### Why `references/` is not hand-copied

The protocol content here is **mirrored**, not hand-copied, from [StepsToGreat](https://github.com/wildcat430524/StepsToGreat).
Change upstream → run the sync script → `references/` follows, with the mapping (and link rewriting) documented in the script itself.
**`SKILL.md` is not in the mirror mapping** — it is a hand-written entry point.

> **Two mechanisms you need to know (both born from bugs)**:
> ① **Links must be recomputed for where the file lands**: `references/模板/` is scaffolding for the *student workspace*,
> and there is no `协议/` directory there — so framework links inside templates must be **rewritten into prose**, or every copy becomes a dead link.
> ② **Validator fixes live upstream**: duplicate verdict detection, annotated evidence paths, and pending-file handling are merged into StepsToGreat. The skill adapts only paths. Both state regression suites test the synchronized implementation; content checks detect drift, and sync tests run in isolated temporary folders.

---

## Adaptive updates

Two layers, don't conflate them:

**① Framework self-update** (shared across sessions and students)

```bash
# report only, write nothing
node scripts/update.mjs --root <your-workspace> --check

# actual update (fill missing lightweight files or update unchanged standalone framework files; preserve learner data)
node scripts/update.mjs --root <your-workspace>

# update the skill itself
node scripts/update.mjs --self        # git checkout → git pull --ff-only
```

The workspace root carries a `.steps2great.json` recording the `skillVersion` at init time.
On takeover the AI compares versions and mentions an update **once**; nothing happens without your consent.

**② Teaching adaptation** (different for every student)

| What adapts | Where it lives |
|---|---|
| Your preferences (question count, tone, Feynman or not) | `我的学习/我的规则.md` — the **overlay, highest priority** |
| Progress, mastered items, open threads | `我的学习/00-学习档案.md` — 🚦 / 📊 / ⏳ |
| Module scope and unit list | The course route `00-课程路线.md` (this is where the bar's K/T comes from) |
| Questions per round, Feynman timing, direct-fix vs. Socratic | Judged **in the moment** from `SKILL.md` and the subject pack — never hardcoded |

**Two iron rules**: rules change in the overlay, never the framework; state lives in three places, never duplicated.

> **CI enforces the first one for you**: the workflow appends a private line to your rules file, records the hash,
> runs `update.mjs`, and requires the hash to be unchanged — otherwise CI goes red.
> See [`.github/workflows/check.yml`](../.github/workflows/check.yml).

---

## Development and self-checks

```bash
node scripts/check.mjs                                    # repo self-check (frontmatter / links / encoding / mirror drift)
node _build/verify-skill-load.mjs                         # loader view: real YAML parser validates SKILL.md
node _build/sync-from-upstream.mjs                        # mirror from upstream (default E:/StepsToGreat)
node _build/sync-from-upstream.mjs --from <path> --dry     # dry-run diff
node scripts/validate-state.mjs --root <workspace>         # validate a workspace's state
node _build/score-workspace.mjs --root <workspace>         # score a tested workspace on six dimensions
npm test                                                  # state regressions + sync regressions + material tools + behaviour evaluation
```

> **Why so many separate checks**: each one catches a pit we actually fell into —
> `check.mjs` catches frontmatter and dead links; `verify-skill-load` catches the YAML error that
> **looks fine as text but breaks loading**; `validate-state` catches self-contradictory profiles;
> the regression cases catch "a fix got wiped by the next change".
> Criteria and history are documented in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## Full FAQ

**How do I know the skill actually loaded?**
Ask it to recite the hard-rule count from `SKILL.md` — the correct answer is **12**.
But this is **only an initial diagnostic**: a correct answer doesn't prove it loaded, and a wrong one doesn't prove it didn't.
A more reliable check combines client loading records, actual file reads, and behaviour before drawing a conclusion.

**My client doesn't load skills. What now?**
First check whether it supports Agent Skills at all (some only read their own rules files).
If it genuinely doesn't, use the previous generation [StepsToGreat](https://github.com/wildcat430524/StepsToGreat)
in its folder form — **the same protocol**, just open the folder.

**Will switching AI clients lose my records?**
No. Everything is plain Markdown in your workspace `我的学习/`. Switch client → open the same workspace → say "continue".

**Do I have to open files and write answers every time?**
No. You can **answer in chat**: the tutor reads the current answer document, **appends your original words unchanged**, then
re-reads the file and runs the full three-dimension assessment for that round. Anything not written to disk isn't guaranteed
to carry over to a new session, so formal submissions are still filed.

**Does it cost anything?**
The protocol itself is free (MIT + CC BY 4.0). **Whether an AI client is free, how much quota it gives you, and whether it needs
an account are decided by each vendor, are unrelated to this project, and change over time** — check the official documentation
for the client you use.

**Do I need to be technical?**
Installation usually needs one `git clone` (or let an AI do it). **Using it needs nothing** — typing is enough.

**Can I throw a whole book at it?**
Yes — that's the most common use. Drop the book into the workspace `资料/`, say "I want to master this", and the tutor
asks about your goals and available time first, then splits it into lessons along the book's **actual chapters**.
See [Start](../README.en.md#start).

**Will the AI make up what's in the book?**
The protocol forbids teaching from memory (hard rule 8): content must come either from files you put in `资料/`
or from a specific, verifiable primary source, cited down to "which file, which section".
**With no textbook supplied**, the tutor works from verifiable primary sources and records them in the lesson document.

> ⚠️ **Honest boundary**: a protocol constrains behaviour but cannot guarantee zero hallucination.
> For critical claims, check the source. You can ask:
> `I can't find this claim in the material. Point to the exact file, section and wording, or retract it and say you're unsure.`

**Will my material be uploaded?**
**Possibly.** That depends on your client and is outside this project's control.
Known: many cloud agents temporarily upload files to build embeddings while indexing.
For **sensitive material**, use a client with local model support, or redact first.

**What if the AI marks me wrong?**
Just say "I think you marked this incorrectly, because…". The protocol **explicitly allows students to challenge**;
on placement conclusions, you win.

**Can I study several subjects at once?**
Yes, but by the rules: **only one "current subject" at a time**, and finish the current round before switching.
Full flow in [`references/协议/03_落档事件表.md`](../references/协议/03_落档事件表.md).

**How do I know the protocol was followed?**
Run the state validator, which checks your profile against the 12 invariants in
[`references/协议/04_状态机.md`](../references/协议/04_状态机.md):

```bash
node scripts/validate-state.mjs --root <your-workspace>
```

It catches things like "marked mastered with no re-assessment evidence" and "advanced before the previous lesson passed".
**A zero exit code does not mean there are no notices**, and it does not mean teaching quality has been verified — it checks
consistency and evidence only.

**What if there's no matching subject pack?**
Five are built in (programming / language / humanities / sciences / exams). If none fits, the AI generates one on the spot from
[`references/学科包/_自定义学科包模板.md`](../references/学科包/_自定义学科包模板.md) — the crux is two questions:
**in this subject, what counts as a structural error (must lose marks) and what is a slip (doesn't)?**
Answer those two and any skill can be assessed — guitar, fitness, drawing, writing, software operation.

**How do I contribute a subject pack?**
Copy [`_自定义学科包模板.md`](../references/学科包/_自定义学科包模板.md), fill it in, open a PR.
**Most needed: music instruments, fitness, drawing, writing, software operation.**

**How do I change my own study rules?**
Write them into the workspace `我的学习/我的规则.md` — it is the **overlay, highest priority**, stored separately from the
framework defaults, and needs no framework edits; still, keep your local changes when updating.

---

## Going deeper

| To understand | Read this |
|---|---|
| **What the AI actually reads** (the compact contract and main loop) | [`SKILL.md`](../SKILL.md) |
| The single source of truth for teaching rules | [`references/协议/`](../references/协议/) |
| How every new block is introduced | [`references/协议/05_对话导入.md`](../references/协议/05_对话导入.md) |
| The criteria for the module bar and skill list | [`references/协议/06_小目标进度.md`](../references/协议/06_小目标进度.md) |
| Which error belongs to which dimension (mnemonic + per-subject boundary cases) | [`references/协议/00_导师协议.md`](../references/协议/00_导师协议.md) §3 |
| **When to write which file** | [`references/协议/03_落档事件表.md`](../references/协议/03_落档事件表.md) |
| The state machine and its 12 invariants | [`references/协议/04_状态机.md`](../references/协议/04_状态机.md) |
| How each subject defines its three dimensions | [`references/学科包/README.md`](../references/学科包/README.md) |
| A 5-minute end-to-end demo | [`references/示例/演示学科/README.md`](../references/示例/演示学科/README.md) |
| **Why these rules were measured, not guessed** | [`references/docs/simulations/`](../references/docs/simulations/) |
| Whether weak models can follow it (incl. 5 real defects) | [`tests/weak-model-report.md`](../tests/weak-model-report.md) |
| End-to-end run report | [`references/docs/E2E-RUN-REPORT.md`](../references/docs/E2E-RUN-REPORT.md) |
| How the behaviour evaluation runs and where its limits are | [`references/docs/behavior-evaluation.md`](../references/docs/behavior-evaluation.md) |
| The reasoning behind each design decision | [`references/docs/adr/`](../references/docs/adr/) (10 entries) |
| Client compatibility matrix (verified 2026-09; ages as vendors change) | [`references/docs/AGENT-COMPAT.md`](../references/docs/AGENT-COMPAT.md) |
| Upgrading the framework / migrating a profile | [`references/docs/UPGRADE.md`](../references/docs/UPGRADE.md) |
| Glossary (tutor vs. vehicle, framework vs. data…) | [`references/CONTEXT.md`](../references/CONTEXT.md) |
| What to PR where / how to sync upstream | [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Why the workspace scaffolding is hand-written | [`templates/workspace/README.md`](../templates/workspace/README.md) |

---

## License

- **Code / scripts**: MIT — see [`LICENSE`](../LICENSE)
- **Docs / protocol**: CC BY 4.0 — see [`LICENSE-DOCS`](../LICENSE-DOCS)

Mirrored content follows upstream licensing. Suggested attribution:

```
Based on StepsToGreat (https://github.com/wildcat430524/StepsToGreat)
and Steps2Great-skill (https://github.com/wildcat430524/Steps2Great-skill),
licensed CC BY 4.0 with the original author's permission.
```
