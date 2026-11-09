// Isolated fixture for "entering learning opens the current round" acceptance.
// Three learning workspaces are built in a temp directory; nothing here touches
// real user learning data. Each workspace keeps a deliberately stale
// `.stg-desk/workbench.json` so the verification proves the recorded current
// round wins over the last browsed round/view.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createWorkbenchService } from '../src/host/service.js';
import { createWorkbenchHandler } from '../src/bridge.js';
import { createLearningSpacesService } from '../src/host/learning-spaces.js';

const project = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const profileFor = ({ lesson, round, guide, answer, subject = 'Java' }) => `# 我的学习档案 · 当前轮次验收

## 🚦 当前交接状态

| 字段 | 值 |
| --- | --- |
| 当前学科 | ${subject} |
| 当前课程 | ${lesson} |
${round ? `| 当前轮次 | ${round} |\n` : ''}| 教学引导 | [阅读本课](${guide}) |
| 学生回答 | [我的回答](${answer}) |
| 状态 | 等待学生作答 |

## 📊 掌握表

| 单元 | 状态 |
| --- | --- |
| 演示 | 未评估 |
`;

const preamble = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 段铺垫：这是上一段学习的内容回顾。`).join('\n\n');
const sameFileGuide = `# 多轮定位课

${preamble}

## 第一轮

### 问题 1

第一轮的问题。

## 第二轮

### 问题 1

第二轮的问题。

## 第三轮

### 问题 1

第三轮的问题。
`;
const answerDoc = `# 多轮定位课 · 学生回答

## 第一轮

### 问题 1

第一轮独有的题面。

**我的回答**：第一轮原答。

### 导师反馈

第一轮反馈。

## 第二轮

### 问题 1

第二轮独有的题面。

**我的回答**：第二轮原答。

## 第三轮

### 问题 1

待作答。
`;

async function buildWorkspace(temp, id, files) {
  const root = path.join(temp, id);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  await fs.mkdir(path.join(root, '.stg-desk'), { recursive: true });
  return root;
}

export async function startCurrentRoundFixture() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-current-round-ui-'));
  const entries = [], choices = [];

  // 1) Same file, several recorded rounds. The profile says 第三轮; the saved
  //    workbench state points at the answer document in answer view.
  const same = await buildWorkspace(temp, 'same-file', {
    '我的学习/00-学习档案.md': profileFor({ lesson: '10-多轮定位', round: '第三轮', guide: './学科/Java/10-多轮定位/01_教学引导.md', answer: './学科/Java/10-多轮定位/01_学生回答.md' }),
    '我的学习/学科/Java/10-多轮定位/01_教学引导.md': sameFileGuide,
    '我的学习/学科/Java/10-多轮定位/01_学生回答.md': answerDoc,
    '.steps2great.json': JSON.stringify({ version: 1, skill: 'steps2great' }),
    '.stg-desk/workbench.json': JSON.stringify({ revision: 9, lastCourseId: '10-多轮定位', lastDocumentPath: '我的学习/学科/Java/10-多轮定位/01_学生回答.md', lastView: 'answer' }),
  });
  entries.push({ id: 'demo', path: same, title: '同文件多轮 · 当前第三轮' });

  // 2) Independent round files. The profile says 第二轮 while a 第3轮 file exists,
  //    and the stale state points at 第3轮: entering must load 第2轮, proving the
  //    current round is consumed from the profile instead of a maximum guess.
  const independentRound = n => `# 第${n}轮教学\n\n${preamble}\n\n## 第${n}轮\n\n### 问题 1\n\n第${n}轮内容。\n`;
  const independent = await buildWorkspace(temp, 'independent', {
    '我的学习/00-学习档案.md': profileFor({ lesson: '11-独立轮次', round: '第二轮', guide: './学科/Java/11-独立轮次/01_教学引导.md', answer: './学科/Java/11-独立轮次/01_学生回答.md' }),
    '我的学习/学科/Java/11-独立轮次/01_教学引导.md': '# 独立轮次课\n\n这一课按轮拆成独立文件。\n',
    '我的学习/学科/Java/11-独立轮次/01_学生回答.md': answerDoc,
    '我的学习/学科/Java/11-独立轮次/第1轮_教学引导.md': independentRound(1),
    '我的学习/学科/Java/11-独立轮次/第2轮_教学引导.md': independentRound(2),
    '我的学习/学科/Java/11-独立轮次/第3轮_教学引导.md': independentRound(3),
    '.steps2great.json': JSON.stringify({ version: 1, skill: 'steps2great' }),
    '.stg-desk/workbench.json': JSON.stringify({ revision: 4, lastCourseId: '11-独立轮次', lastDocumentPath: '我的学习/学科/Java/11-独立轮次/第3轮_教学引导.md', lastView: 'review' }),
  });
  entries.push({ id: 'independent', path: independent, title: '独立文件轮次 · 当前第二轮' });

  // 3) No explicit round and no scanned round marker: safe degrade to the
  //    teaching entry, with all recorded rounds still manually selectable.
  const degrade = await buildWorkspace(temp, 'degrade', {
    '我的学习/00-学习档案.md': profileFor({ lesson: '12-无轮次', round: '', guide: './学科/Java/12-无轮次/01_教学引导.md', answer: './学科/Java/12-无轮次/01_学生回答.md' }),
    '我的学习/学科/Java/12-无轮次/01_教学引导.md': sameFileGuide,
    '我的学习/学科/Java/12-无轮次/01_学生回答.md': '# 回答\n\n## 当前轮\n\n### 问题 1\n没有轮次标记。\n',
    '.steps2great.json': JSON.stringify({ version: 1, skill: 'steps2great' }),
    '.stg-desk/workbench.json': JSON.stringify({ revision: 2, lastCourseId: '12-无轮次', lastDocumentPath: '我的学习/学科/Java/12-无轮次/01_学生回答.md', lastView: 'answer' }),
  });
  entries.push({ id: 'degrade', path: degrade, title: '无明确轮次 · 教学入口降级' });

  // Reuse the same UI bundle as the main browser acceptance run.
  const built = path.join(project, 'artifacts');
  const registry = { get: id => entries.find(w => w.id === id), list: () => entries, create: async (directory, title) => { const entry = { id: `new-${entries.length}`, path: directory, title }; entries.push(entry); return entry; } };
  const learning = createLearningSpacesService({ registry, pickDirectory: async () => { if (!choices.length) throw Error('No fixture picker choice queued'); return choices.shift(); } });
  const service = { ...createWorkbenchService({ resolveWorkspace: learning.resolveWorkspace, learningOnly: true }), ...learning };
  const handler = createWorkbenchHandler(service);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/stg-learning/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const response = await handler(new Request(url, { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) }));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const allowed = { '/': 'preview.html', '/preview.html': 'preview.html', '/preview.js': 'preview.js', '/preview.css': 'preview.css' };
      const filename = allowed[url.pathname];
      if (!filename) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', filename.endsWith('.js') ? 'application/javascript; charset=utf-8' : filename.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
      res.end(await fs.readFile(path.join(built, filename)));
    } catch (error) { res.writeHead(500); res.end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    temp, entries, service,
    close: async () => {
      await new Promise(resolve => server.close(resolve));
      const resolved = path.resolve(temp);
      if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('stg-current-round-ui-')) throw Error('Refused fixture cleanup');
      await fs.rm(resolved, { recursive: true, force: true });
    },
  };
}
