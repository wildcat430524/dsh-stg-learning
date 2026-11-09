# templates/workspace —— 学生工作区脚手架

> `scripts/init-workspace.mjs` 把这里的文件复制到**学生的工作区**。

## 为什么这几个文件不镜像上游

上游 StepsToGreat 里，同样的文件写的是**仓库口径**的相对链接
（`../协议/00_导师协议.md`、`../../AGENTS.md`、`./我的规则.en.md`）。
那些路径在**学生工作区**里并不存在 —— 工作区里没有 `协议/`，也没有 `AGENTS.md`。

所以这四个文件是**手写**的，路径口径改成：

| 上游指向 | 这里指向 |
|---|---|
| `../协议/00_导师协议.md` | skill 的 `references/协议/00_导师协议.md`（说明为「skill 里」） |
| `../AGENTS.md` | `SKILL.md`（说明为「框架入口」） |
| `./我的规则.en.md` | 保留（同目录，确实存在） |

`我的规则.md` / `我的规则.en.md` / `我的学习-README.md` / `资料-README.md`
在 `_build/sync-from-upstream.mjs` 里被显式排除（不在 MAP 里），
同步脚本**不会碰这个目录**。

## 唯一的例外

`我的学习/00-学习档案.md` 起始档案直接取自 `references/模板/学习档案模板.md`
（由 `init-workspace.mjs` 复制），不放在这里 —— 它是上游模板，跟着镜像一起更新。
