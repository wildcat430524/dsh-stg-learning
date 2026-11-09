const CHINESE_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function chineseNumber(text) {
  if (text.includes('十')) {
    const [tens, ones] = text.split('十');
    return (tens ? CHINESE_DIGITS[tens] || 0 : 1) * 10 + (ones ? CHINESE_DIGITS[ones] || 0 : 0);
  }
  return CHINESE_DIGITS[text] || 0;
}

export const roundToken = value => String(value ?? '').replace(/\s+/g, '').match(/第[一二三四五六七八九十\d]+轮|费曼(?:诊断)?轮|摸底轮/)?.[0] || '';

// Filenames, headings and the handoff can spell the same round differently.
export function roundKey(value) {
  const token = roundToken(value);
  const numbered = token.match(/^第(.+)轮$/);
  if (!numbered) return token;
  const number = /^\d+$/.test(numbered[1]) ? Number(numbered[1]) : chineseNumber(numbered[1]);
  return number > 0 ? `第${number}轮` : token;
}
