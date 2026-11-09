# STG 生态来源与教学 Skill 注册

核查日期：2026-10-18（Asia/Shanghai）。本插件不会安装另一套桌面程序，也不把教学资料迁移到隐藏的新工作区。

## 保留的职责

| 组件 | 权威数据与职责 |
| --- | --- |
| StepsToGreat 工作区 | `AGENTS.md`、学生自定义规则、导师协议、学科评估、教学、原答及学习档案 |
| Steps2Great Skill | 工作区初始化与按需读取教学方法；已有工作区以自己的框架版本为准 |
| STG Desk | 可选的独立桌面文档入口，与插件使用同一份 Markdown |
| DSH | 工作区身份、真实会话、输入草稿、模型与账户、权限和工具执行 |
| STG Workbench | 文件视图、追加作答、版本保护、课程与原生会话的持久关联 |

## 来源与许可

- `vendor/stg/` 的解析核心和 `src/editor/stg/` 的编辑器源于 STG Desk 提交 `6b047b17a99d8e467a238b20500698df12d1a5a6`，保留 MIT 许可及各自的 `PROVENANCE.md`。
- `skills/stg-mentor/` 来自 [Steps2Great-skill](https://github.com/wildcat430524/Steps2Great-skill/tree/f8fc81cfd4305da0e627a8a0434c1d153294fc02) 提交 `f8fc81cfd4305da0e627a8a0434c1d153294fc02`，版本 1.2.0。核对了分发副本的 332 个文件：Git blob 哈希全部与该提交一致；没有从上游未提交文件取内容。分发副本不包括上游全部工程文件。
- Skill 的代码与文档分别保留原有 `LICENSE` 和 `LICENSE-DOCS`；引用和再分发应同时保留这些文本及来源，不以插件根目录的 MIT 标签覆盖教学文档许可。
- StudyMate、WorkDSH、思源只用于架构和交互研究，未复制思源主项目实现。

## 不是“复制文件就算接入”

Host 入口在注册 `stg-learning-mentor` 时，计算安装包内 `skills/` 的绝对目录，传入该预设的官方 `dsh-skill-filesystem` 插件配置 `bundledSkillDir`。不复制到用户的 `~/.agents` 或 `~/.dsh`，不修改全局 Profile。

官方 bundled 来源等级低于工作区和用户同名 Skill。默认的项目/用户根目录没有被关闭；学生已有框架与自定义规则仍优先。只有 STG 导师预设增加此打包来源，其他模式不会被强制替换。卸载时随预设作用域释放。

单元测试核查该配置不包含模型、账户或权限覆盖。真实宿主验收另通过 Session 的官方 `sessionSkillCatalog.list` 核查 `steps2great-skill` 可被发现；是否完成真实模型教学不由目录存在或 Skill 可发现推断。

## 已知界限

- 已有会话的能力预设不强制切换；关联旧会话不意味着它自动获得 STG 导师的 Skill 组合。
- 初始化是显式教学/工具操作；打开空目录不会自动写入协议文件或调用模型。
- 插件中的 Skill 是固定快照，不会后台更新独立的 StepsToGreat/Skill 项目。
- 正式评估仍须导师重读保存后的原答并追加证据。保存、切视图和准备请求均不等于通过评估。

## 1.2.0 初始化流程

Skill 已集成 grill-me 风格的需求澄清，不需要安装外部 Skill。先读已有事实，不重复问；无依赖的缺口可合并问，有依赖的选择分轮问，关键决定由学生确认。正常开始只补必要背景；“帮我想清楚”明确选择更深入的澄清。确定目标后按对话导入协议，从场景与当前一个低门槛问题开始，必要时做正式摸底，依据原答制定路线与首课。每轮导学、原答与反馈按协议落档，界面不将存在文件视作能力通过。

导入已有目录不自动升级框架、覆盖 AGENTS 或重置学习记录。打包源通过 Git blob 哈希逐文件核对；同步工具拒绝本地修改，来源清单见 artifacts/teaching-skill-source.json。
