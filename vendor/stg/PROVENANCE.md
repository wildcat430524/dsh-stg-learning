# STG Desk source attribution

These MIT-licensed files are unmodified snapshots of `lib/stg.cjs`, `lib/learning.cjs`, `lib/learning-progress.cjs`, and `lib/answer-records.cjs` from [wildcat430524/STG-Desk](https://github.com/wildcat430524/STG-Desk), commit `6b047b17a99d8e467a238b20500698df12d1a5a6` (v0.3.18 documentation revision).

They were extracted with `git show HEAD:lib/<name>`, rather than copied from the working tree. In particular, the user's uncommitted `lib/answer-records.cjs` was neither copied nor edited. The upstream MIT license is preserved as `LICENSE` in this directory.

The snapshots use `markdown-it` to distinguish real Markdown headings from fenced examples, comments, blockquotes and tutor sections. `src/host` adds DSH workspace confinement, atomic writes, persistent idempotency receipts, history and validated workbench state; it does not modify the teaching or mastery protocol.
