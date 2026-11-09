import { startTeacherFixture } from './teacher-fixture.mjs';
const fixture = await startTeacherFixture();
console.log(JSON.stringify({ url: fixture.url, demoDirectory: fixture.root, pid: process.pid }));
// The demo is confined to a temporary copy. Keep it for recovery when stopped.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
