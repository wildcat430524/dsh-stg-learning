# 0.5.17 验收

239 项单元测试通过。DSH 0.2.2-rc.1 的隔离宿主通过 37 项学习工作台检查和 27 项导师会话检查。导师会话检查覆盖取消移出、移出其他对话时保留当前草稿，以及从「已移出」恢复。测试使用临时学习空间和独立 profile。

# 0.5.16 验收

隔离的 DSH 0.2.2-rc.1 宿主通过 37 项检查，覆盖轮次、直接编辑、保存与草稿、导师会话和旧版课程目录。验收使用独立的临时 profile 和示例学习文件，所有模型会话均保持空白。

25 项视觉检查覆盖浅色和深色配色、代码字体和对比度、窄窗、键盘焦点及减少动态效果。另用 Java 教学示例核对了 440px 窗口下的代码横向滚动。

本地验证命令

```text
npm ci
npm test
npm run build
npm run build:preview
npm run capture:reader
```

视觉检查需要本机 Chrome 或 Edge。浏览器和宿主交互检查还需设置本机 Electron 路径 `STG_ELECTRON_PATH`。可用 `STG_NATIVE_RUNTIME_ANCHOR` 指定宿主安装的包入口。
