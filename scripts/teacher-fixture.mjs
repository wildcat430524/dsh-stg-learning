import { startPreviewFixture } from './preview-fixture.mjs';

/**
 * The adjacent-teacher preview reuses the main Python list/slicing course from
 * demo/StepsToGreat. It does not add a second lesson or rewrite the learning
 * profile, so the reader screenshot and the teacher screenshot always show the
 * same current course. Extra rounds and the negative-index course stay
 * available for course/round switching checks.
 */
export async function startTeacherFixture() {
  const fixture = await startPreviewFixture();
  fixture.course = '我的学习/学科/Python/01-列表与切片';
  fixture.entries[0].title = 'Python · 列表与切片';
  fixture.url += '?teacher=1';
  return fixture;
}
