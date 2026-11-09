/** Shared by the form and host. The host still validates the final path. */
export function validateLearningName(name) {
  if (typeof name !== 'string' || !name.trim()) return '请填写学习空间名称。';
  if (name !== name.trim()) return '学习空间名称不能以空格开头或结尾。';
  if (name.length > 80) return '学习空间名称最多 80 个字符。';
  if (name.isWellFormed && !name.isWellFormed()) return '名称包含无效字符，请重新输入。';
  if (name.startsWith('.')) return '学习空间名称不能以句点（.）开头。';
  if (/[\\/]/.test(name)) return '学习空间名称不能包含斜杠（/）或反斜杠（\\）。';
  if (/[<>:"|?*\u0000-\u001f]/.test(name)) return '学习空间名称不能包含 < > : " | ? * 或控制字符。';
  if (name.endsWith('.')) return '学习空间名称不能以句点（.）结尾。';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) return '这是 Windows 保留名称，请换一个名称。';
  if (/^(node_modules|vendor|release)$/i.test(name)) return '这个名称用于内部文件，请换一个学习名称。';
  return '';
}
