# 贡献指南

> 本仓库是 [StepsToGreat](https://github.com/wildcat430524/StepsToGreat) 的 **skill 封装**。
> 这条关系决定了改哪里 —— **先看下面的「改哪里」再动手**。

---

## 改哪里：一张表

| 你想改的东西 | 改上游还是改这里 |
|---|---|
| 教学规则、评估口径、学科包、模板、教程 | **改上游 StepsToGreat**，然后跑同步脚本 |
| `SKILL.md`（契约与主循环的表述） | **改这里**（它不镜像，是手写的） |
| `scripts/init-workspace.mjs`、`update.mjs`、`check.mjs` | **改这里** |
| `templates/workspace/*` | **改这里**（工作区口径的脚手架，见该目录 README） |
| `README.md` / `README.en.md` | **改这里**（两份都要改） |
| 同步脚本的映射表与链接改写规则 | **改这里**（`_build/sync-from-upstream.mjs` 的 `MAP` / `TRANSFORM`） |

**判据**：`references/` 下的文件顶部都有「只读镜像」的 banner。
**看到 banner 的文件不要直接改** —— 下次同步会被覆盖。

---

## 同步上游

```bash
node _build/sync-from-upstream.mjs                       # 默认源 E:/StepsToGreat
node _build/sync-from-upstream.mjs --from <路径> --dry    # 只看差异，不落盘
node _build/sync-from-upstream.mjs --prune               # 顺带删掉已不在映射里的文件
```

同步完**务必**跑一次检查：

```bash
node scripts/check.mjs
```

它会查：SKILL.md 的 frontmatter 是否合规、有没有坏链、编码是否 UTF-8 无 BOM 且 LF、
代码围栏是否成对、镜像脚本还能不能跑，以及**加载器视角**能不能读（见下节）。

---

## ⚠️ frontmatter 的一条硬约束（踩过一次）

`description` 是**裸标量**时，里面**不能出现 `: `（半角冒号+空格）**。
严格 YAML 解析器会把它当成嵌套映射，直接抛

```
Nested mappings are not allowed in compact mappings
```

结果是 **skill 完全加载不上**（不是警告，是加载失败），而纯文本看起来毫无异常。

所以：值里要冒号就**整行加双引号**，或者改用全角「：」（全角冒号是安全的）。

```yaml
# ❌ 加载失败
description: use when the user asks: teach me

# ✅
description: "use when the user asks: teach me"
```

`scripts/check.mjs` 与 `_build/verify-skill-load.mjs` 都会拦这个错 —— 后者是
**用真实 YAML 解析器**复刻加载器路径（首行 `---` → frontmatter 解析成对象 →
name 合规 → description 长度与双语触发词 → body 可切出）。

```bash
node _build/verify-skill-load.mjs              # 用真实 YAML 解析器
node _build/verify-skill-load.mjs --no-yaml    # 没有 YAML 库时走内置退化解析（同样是硬的）
```

---

## 改 `SKILL.md` 时注意

它是 **Agent Skill 的入口**，有几条硬约束：

1. **frontmatter 必须有 `name` 与 `description`**，且 `name` 是小写字母/数字/连字符。
2. **`description` 是触发层** —— 每一轮都在上下文里，也是 AI 判断要不要用它的唯一依据。
   - 保留中英双语触发词（只留一种语言 = 砍掉一半用户）。
   - 长度控制在 1024 字符内（多了会被客户端截断）。
   - 写的是**分支**（用户会说什么、在什么场景下该触发），不是自我介绍。
3. **正文只放步骤与指针**，长参考推进 `references/`。判断标准：
   **每条分支都要用的放正文，只有部分分支才读的推 reference。**
4. **少用「不要 X」**（把禁忌概念拉进上下文反而更活跃），优先写「要 Y」。
5. 改完自问：**这段话会改变 AI 的默认行为吗？** 不会就是废话，删掉。

---

## 提 PR

- 一次 PR 只做一件事。
- **改了上游规则的话，PR 里请同时说明**：上游的对应 PR/commit，以及同步脚本跑过。
- 别提交 `我的学习/` 或 `资料/` 下的任何内容（本仓库本来也不该有）。

---

## 署名与许可

- 代码 / 脚本：MIT
- 文档 / 协议：CC BY 4.0

从上游镜像来的内容遵循上游许可；署名格式见 `LICENSE-DOCS`。
