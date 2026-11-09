// Keep the upstream teaching framework and its linked documentation intact.
// Other AI editors' entry files are not needed by a DSH-created workspace.
const OTHER_TOOL_ENTRIES = new Set(['CLAUDE.md', 'CODEBUDDY.md', 'GEMINI.md', 'QWEN.md', 'WARP.md']);
export function isDshProjectFile(file) {
  const root = file.split('/')[0];
  return (!root.startsWith('.') || root === '.dsh') && !OTHER_TOOL_ENTRIES.has(root);
}

export const LEARNING_README = `# 我的学习空间

在 DSH 的“学习”中打开这个空间，和老师聊聊想学什么。

- **我的学习/**：学习档案、课程、作答和反馈。
- **资料/**：学习时参考的材料。
- **我的学习/我的规则.md**：你希望老师记住的学习偏好。

还没有课程时，先与老师交流，第一课准备好后会显示在学习页面。
你的学习文件保存在本地；已有内容不会因为重新打开而被清空。

其余文件是老师使用的教学框架，通常不需要手动填写。
框架来自 StepsToGreat，教学协议、模板、质检工具及许可证保留在原路径。
需要了解框架时可查看 [导师入口](AGENTS.md) 和 [升级说明](docs/UPGRADE.md)。
`;
