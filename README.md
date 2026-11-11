# STG Learning Workbench

在 DeepSeek Harness（DSH）里读课、作答、和导师讨论。课程、原答和反馈保存在你的 StepsToGreat 学习目录中，下次打开学习空间就能接着学。

**[下载最新版插件](https://github.com/wildcat430524/dsh-stg-learning/releases/latest)** · [查看 v0.5.17 更新](https://github.com/wildcat430524/dsh-stg-learning/releases/tag/v0.5.17)

v0.5.17 已在 DSH 0.2.2-rc.1 验收。安装包的 `engines.dsh` 列出声明兼容的宿主版本。

## 安装并开始学习

1. 下载 Release 附件中的 `dsh-stg-learning-*.tgz`。打开 DSH 的「插件」页，从本地文件安装并启用。若提示重启，保存当前工作后重启 DSH。
2. 从左侧进入「学习」。选「新学习」，填名称并选择新文件夹的上一级目录。已有学习资料时，点「导入已有 StepsToGreat 文件夹」并选择学习目录的根目录。两种操作均使用 DSH 桌面端的文件夹选择器。
3. **第一次学习**时，写下想学的主题、自己的基础或眼前的问题，选「直接开始」或「帮我理清目标」，再点「和老师聊聊」。检查 DSH 输入框里的草稿后发送。**已有课程**时，工作台会打开档案记录的当前课程和轮次。

导师使用 DSH 中配置的模型。阅读、编辑、保存作答和查看历史可以独立使用。

## 学习工作台

![DSH 学习工作台中的 Python 列表与切片示例，左侧为学习入口，中间是教学引导，右侧是导师对话](docs/screenshots/learning-workbench-v0.5.17.png)

*在示例课程中阅读教学引导，并在旁边打开原生导师对话。*

- **阅读和作答**。在「阅读」「作答」「复习」之间切换。阅读支持公式、代码、表格和本地图片，教学文档可直接编辑或切换到 Markdown 源文。点击「保存作答」会把原答写入学生回答文档。
- **问导师和提交评估**。选中课文中的一段文字即可带着上下文提问。完成作答后可点「保存并准备评估」，检查请求后在 DSH 输入框发送。导师按当前学科的规则复核原答，掌握状态以文档中的评估记录为准。
- **回看之前的学习**。在顶部搜索课程或切换轮次。历史轮可以查看当时的题目、原答和导师反馈，切回当前轮可继续草稿。文档历史版本支持预览和恢复。
- **继续或重开对话**。首次开场后可返回学习页，选择「继续原对话」，也可以「用新主题重新开始」。导师菜单和「学习会话」页可以移出选中的对话，再从「已移出」恢复。移出采用 DSH 的可恢复归档。

## 文件保存在哪里

| 内容 | 位置 |
| --- | --- |
| 教学、原答、评估和学习档案 | 你选择的学习目录中的 Markdown 文件 |
| 课程与会话关联、文档备份 | 学习目录下的 `.stg-desk/` |
| 未保存的文档和作答草稿 | 当前 DSH 页面使用的本机浏览器存储 |
| 导师对话、模型和账户设置 | DSH 原生存储 |

如果课文在编辑期间被其他程序修改，工作台会保留草稿并提示对照。工作台支持 UTF-8 Markdown 和 TXT，每份文档最多 8 MiB。PNG、JPEG、GIF、WebP 本地图片可随文档展示。PDF 或 Word 资料可以先转成 Markdown 再阅读。

## 相关项目

- StepsToGreat 定义学习目录、课程和档案的结构。[项目主页](https://github.com/wildcat430524/StepsToGreat) · [下载学习框架 ZIP](https://github.com/wildcat430524/StepsToGreat/archive/refs/heads/main.zip)
- STG Desk 是独立的桌面阅读、编辑与作答应用，可与插件打开同一个学习目录。[项目主页](https://github.com/wildcat430524/STG-Desk) · [下载 STG Desk](https://github.com/wildcat430524/STG-Desk/releases/latest)
- Steps2Great-skill 提供导师使用的教学方法和参考规则。[项目主页](https://github.com/wildcat430524/Steps2Great-skill)

## 命令行安装与开发

使用与桌面端匹配的 DSH CLI，把命令中的路径换成下载包的绝对路径。

```text
dsh plugin --profile desktop add /absolute/path/dsh-stg-learning-0.5.17.tgz
```

开发需要 Node.js 24+。在仓库根目录安装依赖、构建并运行测试。

```sh
npm ci
npm run build
npm test
```

`npm pack` 生成安装包。浏览器和宿主验收使用临时学习目录，运行 `npm run test:browser` 或 `npm run test:native` 前需设置本机 Electron 路径 `STG_ELECTRON_PATH`。验证和集成细节见 [验收记录](VERIFICATION.md)、[宿主文件接口](docs/HOST.md) 和 [原生会话集成](docs/NATIVE.md)。

## 许可证

插件采用 [MIT](LICENSE)。复用的 STG Desk 组件和打包依赖保留各自的许可说明，见 [第三方许可清单](THIRD-PARTY-NOTICES.md)。
