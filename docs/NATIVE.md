# DSH 原生接入与运行约定

当前 0.5.7 支持 `@deepseek-ai/dsh`、`@deepseek-ai/dsh-web-app` 的 **0.2.1-rc.1 / rc.2 / rc.3 / rc.4**，详细范围、降级行为与验收命令见 [多版本兼容说明](DSH-COMPATIBILITY-20261027.md)。以下接口设计最初核查于 rc.2 官方源码 `687f282e8625c6b8d11ff58211a90524be2e4317`；0.2.0 与旧 0.1.x 不作为本版完整兼容承诺。

## 数据与鉴权

Host 入口依赖 `connection`、`workspaceRegistry`、`agentPresets`。所有学习数据请求注册在 `ctx.connection.fetch.register` 的 `/api/stg-learning/*` 精确路由上；没有独立监听器，也没有直接向 `webServer` 注册未鉴权文件服务。Web 经过 Connection 的 Host/Origin、浏览器 Cookie、owner Peer 和安装锁 `connection/request` 检查；Desktop/Worker 继续使用其官方 Fetch carrier。STG 不读取令牌、凭据文件或登录存储。

浏览器仅传 DSH 已登记的 `workspaceId` 和相对文档路径。工作区根目录由 `workspaceRegistry.get(workspaceId)` 解析；不接受浏览器提供的绝对根路径。域服务另行实施路径约束、版本冲突、原子写入、历史备份和幂等检查。HTTP 返回 `{ok:true,data}` 或 `{ok:false,error:{code,message,details?}}`；未知服务异常只返回通用错误，不暴露服务器内部数据。

公开路由包括 `workspace`、`document`、`answers`、`history`、`history/document`、`history/restore`、`state` 和 `asset`。文档保存兼容 `PUT /document`，状态更新兼容 `PATCH /state`。0.2.1-rc.2 的 `ConnectionFetchMethod` 类型只列 `GET|HEAD|POST`，但同版精确路由和 HTTP bridge 的运行时按原始 method 分派。因此 API 适配器默认使用同一资源的 **POST 别名**，以保持官方类型和 Desktop carrier 兼容。两种写法进入相同域方法及相同鉴权。原始 JSON 请求上限 50 MiB，覆盖 JSON 转义膨胀；域服务仍限制解码后的文件大小。图片只返回安全 MIME 字节，并附 `nosniff`、`no-store`、CSP sandbox。

客户端使用公开 `__DSH_TRANSPORT__.fetch`（存在时）或 `globalThis.fetch`，路由为相对文档的 `api/stg-learning`，保留反向代理的挂载前缀。API 不自行建立连接、附加 token 或另存认证状态。

## 页面与会话

`applyNative(ctx,{renderDocumentEditor,onManageSessions})` 注册 `sidebar.panellist` 的“学习”入口和 `main` 的 `stg-learning` 页。原会话管理可以独立注册 `stg-learning-sessions`，作为工作台内次级入口。组件通过框架 `useWorkspaces`、`useSessions` 获取宿主快照；传给 Workbench 的是投影后的工作区数据与动作回调，不是整个 DSH 服务对象。

0.4.0 不再渲染嵌入会话、SessionProvider 或自建聊天输入框。学习页提供初始化引导与文档工作台；点击导师通过 sessions.retain 等待会话就绪，再用 uiWorkspace.openSession 打开 DSH 原生完整主对话。模型选择、工具流与唯一 composer 全部属于 DSH。

请求使用应用级 mailbox 按 sessionId 交接；conversation.input.dock 中的 Session-scoped 组件接收，等待原生输入就绪后通过 inputActions.captureInsertion / insertText / persistDraft 追加，不调用发送。重复待处理请求合并；错误、超时与卸载明确失败，不覆盖已有输入。空白 hero 不挂载 session.header.utilities，composer.dock 也只在 active composer 出现，因此不能使用它们消费首轮草稿。input.dock 同时覆盖 hero 与 active，并提供“学习内容”返回同一空间。

courseSessions 使用稳定课程目录 ID 关联原生会话，保存在 .stg-desk/workbench.json。初始化先使用 _workspace，出现第一课后继承该关联；显式课程关联优先。重复点击合并创建，持久化冲突重读合并；写盘失败保留已创建 ID 供重试，不重置已有会话预设。切页不发送请求，交接完成或失败后释放临时 retained reference；主会话由宿主管理其引用。

## 导师模式与动作

Host 通过官方 `agentPresets.register` 注册独立的 `stg-learning-mentor`，按插件生命周期撤销，不改用户 default、profile、模型、provider、推理等级或权限设置。该模式是可见的正式模式，未使用不存在的 hidden 字段。导师自己的 `dsh-skill-filesystem` 配置安装包内的 `bundledSkillDir`，保持项目与用户 Skill 优先；详情见 `ECOSYSTEM.md`。

模式组成取自官方 standard 预设的必要能力：`dsh-persona`、`dsh-agent-instructions`、`dsh-time-context`、`dsh-tool-fs`、`dsh-tool-fs-search`、`dsh-skill-filesystem`、`dsh-tool-skill`。没有绕过宿主文件权限/审批，未另设执行或后台模型。编程作答遵循 StepsToGreat 默认静态核对，不额外加入 shell 编译能力。

导师遵循现有工作区协议：1–3 题每轮；重新读取原答和修订再评估；三维为概念理解、逻辑正确、规范表达（第三维采用学科口径，费曼题有不适用维度）；原答与评估追加留档；证据不足不通过；全课通过后才按事件表更新档案。文件中的学习事实仍是权威，界面视图和会话标题不会标记掌握。

“提问/准备评估/复习/继续”只准备请求，使用官方 `inputActions.captureInsertion/insertText/persistDraft` 写入原生草稿。span 采用 revision CAS，折叠已有选择以保留用户选中的输入。**从不调用 submit**；用户在原生输入框确认发送后才运行模型。请求携带课程/文件/版本/轮次定位与明确选文，不复制整个当前文档，正式评估要求导师重新读取磁盘证据。打开页面、选课程、切视图都不发送消息。

## 核查与测试边界

`tests/native-*.test.js` 覆盖注册路径、工作区身份、HTTP 错误、转义容量、图片字节、shell carrier、认证错误、取消、会话复用/冲突/释放以及草稿保护。域层与实际宿主加载、UI 渲染的最终验收由对应测试另行完成；这些协议单测不等同于已发起真实模型调用。

一手参考：

- [Connection 鉴权与精确 Fetch 路由](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/connection/README.md)
- [Connection 运行时 route dispatch](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/connection/src/rpc-host.ts)
- [Session create/retain 契约](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/api/session-controller/src/client/contract/sessions.ts)
- [Conversation factory 与单 composer 限制](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/ui-conversation/README.md)
- [官方标准模式组合](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/bundle/web-app/presets/standard.patch.yml)
