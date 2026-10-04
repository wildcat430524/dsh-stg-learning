# DSH STG Learning

安装在 DeepSeek Harness 内的学习工作区和学习会话管理插件。插件与 **STG Desk** 是两个独立项目；STG Desk 的学习页面、文档编辑、侧边对话和浮窗保持原样。

## 功能

- DSH 左侧新增 **学习** 入口，打开独立学习管理页面。
- 从 DSH 已有工作区中选择学习文件夹，标记为学习工作区。
- 集中查看学习会话，按课程或标题搜索，按学习阶段筛选，或只看置顶会话。
- 给会话设置课程与“学习中 / 待复习 / 已结束”整理标记。
- 继续原生 DSH 会话，或在选定工作区新建学习会话。
- 可填写本机 STG Desk.exe 路径，从插件打开 STG Desk。

会话、模型、消息全部使用 DSH 的原生服务。插件不提供第二套聊天后端、不读取模型密钥，也不自动发送模型请求。标记仅存于此设备的 DSH 浏览器存储，不自动写入学习档案、不代替真实掌握评估。卸载插件不会删除 DSH 会话和 STG 文档。

## 下载 STG Desk

插件顶部提供「下载 STG Desk」入口，打开 [STG Desk 最新发布页](https://github.com/wildcat430524/STG-Desk/releases/latest)。下载 Windows 便携版并运行，再在「STG 协作」中填写 exe 路径。插件自身的学习会话管理可以独立使用；文档阅读、编辑和作答由 STG Desk 提供。

## 安装

从 [插件 Releases](https://github.com/wildcat430524/dsh-stg-learning/releases/latest) 下载 `.tgz`，在 DSH 的 **插件** 页面安装本项目的本地 `.tgz` 包，例如 `dsh-stg-learning-0.1.3.tgz`。也可以使用与你的 DSH 版本对应的命令行，在支持插件管理的 profile 中安装包：

```text
dsh plugin --profile web add /完整路径/dsh-stg-learning-0.1.3.tgz
```

桌面版使用它自己的插件管理入口，避免误用另一份旧版 `dsh` 命令修改 desktop profile。启用后左侧显示“学习”。在插件管理页面可禁用或卸载。

## 与 STG Desk 配合

1. 在 DSH 添加已有 STG 学习文件夹，并在“学习”页面标记该工作区。
2. 打开或新建该工作区的学习会话。
3. 在 STG Desk 导入相同文件夹；连接 DSH，在对话菜单选择同一个会话。
4. 两边沿用同一 DSH 会话与当前可调用的模型；STG 的原有界面保持不变。

“打开 STG Desk”只打开填写的本机应用，不会自动切换其已打开的文档或工作区。

## 开发与打包

```text
npm ci
npm test
npm run build
npm pack
```

源代码位于 `src/`；`src/index.js` 是 DSH 宿主入口，`src/client.jsx` 是浏览器插件入口；构建脚本生成 DSH `__ModuleLoader__` 可加载的 `lib/client.js`。React 使用 DSH 的已有运行时，不随插件复制宿主服务或运行时。插件样式仅作用于 `.stgl-*`，支持 DSH 主题变量与减少动态效果。

## 项目边界

- **STG Desk**：学习文档、作答、阅读编辑和协作对话窗口。
- **DSH STG Learning**：DSH 内的学习工作区与会话管理。
- **DeepSeek Harness**：独立上游宿主，提供模型和原生会话能力，不属于这两个项目的源码。

本项目采用 MIT 许可证。首次版本的兼容性与实际安装验收记录见交付的验证说明；不声称已经覆盖所有 DSH 版本与平台。
