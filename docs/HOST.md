# STG Workbench host service

`src/host/service.js` exports `createWorkbenchService({ resolveWorkspace })`. The injected asynchronous resolver is the only authority for `{ workspaceId, path, title }`: it must consult DSH's registered workspaces and throw for unknown ids. Browser requests never select an arbitrary filesystem root. The host uses Node built-ins and the plugin's `markdown-it` runtime dependency.

The public methods match `WORKBENCH-CONTRACT.md`: `workspace`, `read`, `save`, `answer`, `history`, `historyRead`, `restore`, `state`, `updateState`, and `asset`. Every method accepts a single object containing `workspaceId`; document operations additionally take a forward-slash workspace-relative `path`.

## Learning evidence

`workspace` returns the safe document tree, course/round navigation, current lesson, profile snapshot, original STG progress projection, warnings, and persisted workbench state. Current teaching and answer paths come from the profile's current-handoff section; opening a course or changing views never marks mastery. Course ids are relative course directories (`.` for a root-level course). Round ids are the guide path, or `<guide-path>#round=<encoded-round-name>` when one guide contains several rounds. The round's separate `path` is always the actual document path.

Document snapshots contain `path`, `content`, content-hash `version`, `questions`, `records`, and `modifiedAt`. `questions` uses the original STG parser, including source-offset ids and current-round detection. `records` additionally exposes original answer/tutor sections as exact source slices. Malformed individual course documents produce workspace warnings and remain source-editable when they are valid UTF-8. No percentages, mastery scores, tutor output, or assessment conclusions are invented.

The MIT STG parser and progress snapshots are attributed in `vendor/stg/PROVENANCE.md`, with the upstream license preserved. They were extracted from commit `6b047b17a99d8e467a238b20500698df12d1a5a6` using `git show`; no dirty STG Desk working-tree file was copied.

## Writes, retries and recovery

`save`, `answer`, and `restore` require the document's `expectedVersion` (lowercase SHA-256) and a new `operationId` (1–160 characters; alphanumeric first, then alphanumeric or `._:-`). Use a UUID for each logical action and reuse it only when retrying that same action with the identical payload and base version. Reusing an id for changed content yields `OPERATION_CONFLICT` (409).

All service instances in one Node process serialize writes to the same canonical document. Before each replacement, the content hash is checked again; stale or externally changed content yields `VERSION_CONFLICT` (409) and never silently replaces that detected external version. Writes use a unique adjacent temporary file, a flushed file handle, and a rename. There is no portable Node filesystem compare-and-swap with another process: an unrelated editor can still race in the final interval between the last hash check and rename. Plugin-internal concurrent saves are serialized.

App-owned metadata lives exclusively in the registered workspace's `.stg-desk` directory:

- `backups/<path-hash>-<timestamp>-<uuid>.bak`: complete document versions before replacement. History is not automatically pruned. A restore first backs up the currently open version, so it can be undone through history.
- `operations/<operation-id-hash>.json`: prepared/committed retry receipts. A receipt is flushed before replacing a document. If the process stops after replacement but before receipt commit, replay detects the result hash and commits the existing result; if it stopped earlier, replay resumes the prepared write. A divergent file requires conflict recovery. A completed replay returns the original action's snapshot rather than appending an answer again.
- `workbench.json`: validated view/course/session association state with a monotonic `revision`.

Answers contain 1–3 unique `{id,text}` entries, reference only current questions, and contain nonempty text. The current round itself must have 1–3 recognized questions. Old-round ids and stale versions are rejected. Answer text is appended inside a sufficiently long text fence: embedded Markdown headings and code fences cannot become tutor questions. Existing attempts, original answer slots, tutor sections and the profile are preserved.

`history` returns `{items:[{id,date,bytes}]}`; ids are opaque and bound to a single document. `historyRead` returns `{content}`. Missing history returns an empty list without creating metadata directories.

## Persistent workbench state

`state` returns `{ revision, lastCourseId?, lastDocumentPath?, lastView?, courseSessions? }`. `updateState` accepts `patch` and optional `expectedRevision`; an outdated revision yields `STATE_CONFLICT` (409). Concurrent updates merge under the shared state lock. `courseSessions` merges by course id. A `null` patch field removes that optional field; a `null` session association removes that mapping.

The allowlist is deliberately limited to `lastCourseId`, `lastDocumentPath`, `lastView` (`read`, `answer`, `review`), and `courseSessions`. Credentials, messages, unknown fields, unsafe paths and prototype-polluting keys are rejected. Invalid existing state is preserved and never overwritten automatically; the workspace overview isolates it as a warning so lesson documents remain available. This state contains navigation and session references, not learning facts or model configuration.

## File and asset boundaries

Both reads and writes reject absolute/drive paths, traversal segments, Windows alternate data streams/device names, hidden paths, ignored application folders, and links that escape the registered root or resolve to hidden/application paths. Public document aliases may follow up to 40 internal symlink/junction hops; each destination is checked. The tree uses canonical identities and deduplicates visited directories/files to prevent cycles. The registered root itself is canonicalized through `realpath`. Internal metadata directories and files still reject every symlink/junction, including links within the workspace. Writes, operation receipts, mutexes and history share the canonical document identity; public alias saves replace the real file, not the link, and check alias targets again before replacement. Documents must be valid UTF-8 Markdown/Markdown-extension/TXT files, up to 8 MiB. Unsupported and malformed files are never transcoded automatically.

`asset` returns `{bytes: Buffer, mime}` for the native HTTP response. Only PNG, JPEG, GIF, WebP and AVIF extensions with matching byte signatures are accepted, up to 20 MiB. SVG/HTML and disguised files are rejected. The bridge should return the exact image MIME and `X-Content-Type-Options: nosniff`; it should not JSON-encode the byte buffer.

Errors expose `code`, HTTP `status`, human-readable `message` and optional JSON `details`. Domain errors include `WORKSPACE_NOT_FOUND`, `INVALID_PATH`, `DOCUMENT_NOT_FOUND`, `VERSION_CONFLICT`, `STATE_CONFLICT`, `INVALID_ANSWERS`, `UNSUPPORTED_DOCUMENT`, `INVALID_ENCODING`, `DOCUMENT_TOO_LARGE`, `UNSUPPORTED_ASSET`, `OPERATION_CONFLICT`, and `OPERATION_RECOVERY_REQUIRED`. Unexpected filesystem errors are mapped without exposing absolute host paths.

## Verification

Run `node --test tests/host-service.test.js`. Tests construct and remove temporary workspaces only. They cover the committed demo content, safe question/tutor parsing, append-only repeated attempts, duplicate/stale/malformed answers, multiple service instances, external modifications, history and reversible restores, durable receipt replay on both sides of replacement, revision conflicts and concurrent state merges, corrupt state preservation, path traversal/Windows aliases/junctions/symlinks, malicious metadata links, UTF-8/size limits, and executable asset rejection.

The host service does not start DSH, create an HTTP listener, edit global settings, choose accounts/models, or modify the STG Desk source tree. Native DSH registration/authentication and final UI integration remain the entry adapter's responsibilities.
