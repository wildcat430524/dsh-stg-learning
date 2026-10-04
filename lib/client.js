window.__ModuleLoader__.load({id:"dsh-stg-learning",factory:(require)=>{const module={exports:{}};const exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.jsx
var client_exports = {};
__export(client_exports, {
  LearningPanel: () => LearningPanel,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);

// src/model.js
var METADATA_VERSION = 1;
var STAGES = Object.freeze(["learning", "review", "done"]);
var DEFAULT_STAGE = "learning";
var COURSE_MAX_LENGTH = 200;
var STAGE_SET = new Set(STAGES);
var POLLUTION_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var MAX_KEY_LENGTH = 1024;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readField(object, key) {
  try {
    return object[key];
  } catch {
    return void 0;
  }
}
function hasOwn(object, key) {
  try {
    return Object.prototype.hasOwnProperty.call(object, key);
  } catch {
    return false;
  }
}
function ownField(object, key) {
  return hasOwn(object, key) ? readField(object, key) : void 0;
}
function isCleanKey(key) {
  return typeof key === "string" && key.length > 0 && key.length <= MAX_KEY_LENGTH && key.trim() !== "" && !POLLUTION_KEYS.has(key);
}
function ownEntries(value) {
  if (!isRecord(value)) return [];
  let keys;
  try {
    keys = Object.keys(value);
  } catch {
    return [];
  }
  const entries = [];
  for (const key of keys) {
    if (!isCleanKey(key)) continue;
    entries.push([key, readField(value, key)]);
  }
  return entries;
}
function textOrUndefined(value) {
  return typeof value === "string" && value.trim() !== "" ? value : void 0;
}
function normalizeCourse(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > COURSE_MAX_LENGTH ? trimmed.slice(0, COURSE_MAX_LENGTH) : trimmed;
}
function normalizeStage(value) {
  return typeof value === "string" && STAGE_SET.has(value) ? value : DEFAULT_STAGE;
}
function normalizePinned(value) {
  return value === true;
}
function normalizeMetadata(input) {
  const source = isRecord(input) ? input : {};
  const workspaces = {};
  const sessions = {};
  for (const [workspaceId, entry] of ownEntries(readField(source, "workspaces"))) {
    if (!isRecord(entry)) continue;
    workspaces[workspaceId] = { enabled: readField(entry, "enabled") === true };
  }
  for (const [sessionId, entry] of ownEntries(readField(source, "sessions"))) {
    if (!isRecord(entry)) continue;
    sessions[sessionId] = {
      course: normalizeCourse(readField(entry, "course")),
      stage: normalizeStage(readField(entry, "stage")),
      pinned: normalizePinned(readField(entry, "pinned"))
    };
  }
  return { version: METADATA_VERSION, workspaces, sessions };
}
function timeOf(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  if (trimmed === "") return void 0;
  if (/^-?\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : void 0;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function basenameOf(path) {
  const trimmed = path.replace(/[/\\]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(cut + 1);
}
function isWindowsSpelling(path) {
  return /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]{2}[^\\/]/.test(path);
}
function normalizePathSpelling(path) {
  const trimmed = path.replace(/[/\\]+$/, "");
  if (trimmed === "") return "/";
  return trimmed.replace(/\\/g, "/");
}
function samePath(left, right) {
  const normalizedLeft = normalizePathSpelling(left);
  const normalizedRight = normalizePathSpelling(right);
  if (isWindowsSpelling(left) || isWindowsSpelling(right)) {
    return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }
  return normalizedLeft === normalizedRight;
}
function titleOf(summary, id) {
  const durable = textOrUndefined(readField(summary, "title"));
  if (durable !== void 0) return durable;
  const projected = textOrUndefined(readField(summary, "displayTitle"));
  if (projected !== void 0) return projected;
  const cwd = textOrUndefined(readField(summary, "cwd"));
  if (cwd !== void 0) {
    const base = basenameOf(cwd);
    if (base !== "") return base;
  }
  return id;
}
function sortRows(rows) {
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    if (left.row.pinned !== right.row.pinned) return left.row.pinned ? -1 : 1;
    const leftTime = left.row.updatedAt;
    const rightTime = right.row.updatedAt;
    const leftKnown = typeof leftTime === "number";
    const rightKnown = typeof rightTime === "number";
    if (leftKnown && rightKnown && leftTime !== rightTime) return rightTime - leftTime;
    if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
    return left.index - right.index;
  }).map((entry) => entry.row);
}
function currentSessionId(snapshot) {
  const byId = readField(snapshot, "byId");
  if (isRecord(byId)) {
    for (const id of Object.keys(byId)) {
      const retained = readField(ownField(byId, id), "retainedBy");
      if (readField(retained, "mainView") > 0) return id;
    }
  }
  const legacy = readField(snapshot, "current");
  return typeof legacy === "string" ? legacy : void 0;
}
function learningSessions(options) {
  const request = isRecord(options) ? options : {};
  const sessionSnapshotValue = readField(request, "sessions");
  const sessionSnapshot = isRecord(sessionSnapshotValue) ? sessionSnapshotValue : {};
  const byIdValue = readField(sessionSnapshot, "byId");
  const byId = isRecord(byIdValue) ? byIdValue : {};
  const current = currentSessionId(sessionSnapshot);
  const workspaceSnapshot = readField(request, "workspaces");
  let workspaceItems = [];
  let archivedValue;
  if (Array.isArray(workspaceSnapshot)) {
    workspaceItems = workspaceSnapshot;
  } else if (isRecord(workspaceSnapshot)) {
    const itemsValue = readField(workspaceSnapshot, "items");
    if (Array.isArray(itemsValue)) workspaceItems = itemsValue;
    archivedValue = readField(workspaceSnapshot, "archivedSessionIds");
  }
  const archived = new Set(
    Array.isArray(archivedValue) ? archivedValue.filter((id) => typeof id === "string") : []
  );
  const workspaceId = readField(request, "workspaceId");
  if (typeof workspaceId !== "string" || workspaceId === "") return [];
  const workspace = workspaceItems.find(
    (item) => isRecord(item) && readField(item, "workspaceId") === workspaceId
  );
  if (!isRecord(workspace)) return [];
  const memberIdsValue = readField(workspace, "sessionIds");
  const memberIds = Array.isArray(memberIdsValue) ? memberIdsValue : [];
  const pathValue = readField(workspace, "path");
  const workspacePath = typeof pathValue === "string" ? pathValue : "";
  const metadataValue = readField(request, "metadata");
  let marks = {};
  if (isRecord(metadataValue)) {
    const marksValue = readField(metadataValue, "sessions");
    if (isRecord(marksValue)) marks = marksValue;
  }
  const queryValue = readField(request, "query");
  const query = (typeof queryValue === "string" ? queryValue : "").trim().toLowerCase();
  const rows = [];
  const seen = /* @__PURE__ */ new Set();
  for (const id of memberIds) {
    if (typeof id !== "string" || id === "" || seen.has(id)) continue;
    seen.add(id);
    const summary = ownField(byId, id);
    if (!isRecord(summary)) continue;
    if (readField(summary, "origin") === "subagent") continue;
    if (archived.has(id)) continue;
    const cwd = textOrUndefined(readField(summary, "cwd"));
    if (cwd !== void 0 && workspacePath.trim() !== "" && !samePath(cwd, workspacePath)) continue;
    const title = titleOf(summary, id);
    const markValue = ownField(marks, id);
    const mark = isRecord(markValue) ? markValue : void 0;
    const course = mark === void 0 ? "" : normalizeCourse(readField(mark, "course"));
    const stage = mark === void 0 ? DEFAULT_STAGE : normalizeStage(readField(mark, "stage"));
    const pinned = mark === void 0 ? false : normalizePinned(readField(mark, "pinned"));
    if (query !== "" && !title.toLowerCase().includes(query) && !course.toLowerCase().includes(query)) {
      continue;
    }
    rows.push({
      id,
      title,
      cwd,
      updatedAt: timeOf(readField(summary, "updatedAt")),
      course,
      stage,
      pinned,
      current: id === current
    });
  }
  return sortRows(rows);
}

// src/style.js
var css = `
.stgl-page{--stgl-panel:var(--dsw-alias-bg-base,#fff);--stgl-ink:var(--dsw-alias-label-primary,#303846);--stgl-muted:color-mix(in srgb,var(--stgl-ink) 64%,var(--stgl-panel));--stgl-line:color-mix(in srgb,var(--stgl-ink) 11%,var(--stgl-panel));--stgl-soft:color-mix(in srgb,var(--stgl-ink) 4%,var(--stgl-panel));height:100%;overflow:auto;background:var(--stgl-soft);color:var(--stgl-ink);padding:28px;box-sizing:border-box;font-family:inherit;scrollbar-width:thin}
.stgl-page *{box-sizing:border-box}.stgl-inner{max-width:1100px;margin:0 auto}.stgl-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}.stgl-eyebrow{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:1.5px;color:var(--stgl-muted);margin-bottom:8px}.stgl-heading h1{font-size:26px;line-height:1.3;margin:0 0 7px;font-weight:600;letter-spacing:-.6px}.stgl-subtitle{font-size:12px;font-weight:500;color:var(--stgl-muted);line-height:1.7;margin:0}.stgl-heading-actions{display:flex;gap:8px;flex-shrink:0}
.stgl-page button,.stgl-page input,.stgl-page select{font:inherit}.stgl-page button{cursor:pointer;transition:background-color 160ms,box-shadow 160ms,border-color 160ms,transform 140ms;border:1px solid var(--stgl-line);border-radius:11px;background:var(--stgl-panel);padding:9px 12px;font-size:12px;color:inherit;font-weight:500;line-height:1.4}.stgl-page button:hover:not(:disabled){border-color:color-mix(in srgb,var(--stgl-ink) 24%,var(--stgl-panel));box-shadow:0 3px 9px #10182808;transform:translateY(-1px)}.stgl-page button:active:not(:disabled){transform:translateY(1px)}.stgl-page button:disabled{opacity:.45;cursor:default}.stgl-page button.stgl-primary{background:var(--dsw-alias-button-primary-fill,var(--stgl-ink));color:var(--dsw-alias-label-primary-inverted,var(--stgl-panel));border-color:var(--dsw-alias-button-primary-fill,var(--stgl-ink));white-space:nowrap;padding:11px 15px}.stgl-page button.stgl-pin{display:grid;place-items:center;width:28px;height:28px;padding:0;border-color:transparent;background:transparent;color:var(--stgl-muted);border-radius:8px}.stgl-page button.stgl-pinned{color:var(--stgl-ink);background:var(--stgl-soft)}
.stgl-page input,.stgl-page select{border:1px solid var(--stgl-line);border-radius:10px;background:var(--stgl-panel);padding:10px 11px;font-size:12px;color:inherit;min-width:0;outline:none;line-height:1.5}.stgl-page input::placeholder{color:var(--stgl-muted);opacity:.8;font-weight:400}.stgl-page :is(input,select,button):focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:2px}.stgl-controls{background:var(--stgl-panel);border:1px solid var(--stgl-line);border-radius:18px;padding:15px 16px;margin-bottom:20px;box-shadow:0 2px 8px #10182803}.stgl-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.stgl-workspace-label{display:flex;align-items:center;gap:9px;max-width:38%;color:var(--stgl-muted);font-size:11px;font-weight:500}.stgl-workspace-label>span{white-space:nowrap}.stgl-workspace{max-width:260px;font-weight:500!important}.stgl-search{flex:1;min-width:130px!important;background:var(--stgl-soft)!important;border-color:transparent!important}.stgl-workspace-meta{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--stgl-line)}.stgl-workspace-meta .stgl-time{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stgl-workspace-meta button{padding:3px 7px;border-color:transparent;background:transparent;white-space:nowrap;font-size:11px;color:var(--stgl-muted)}
.stgl-filterbar{display:flex;justify-content:space-between;gap:10px;align-items:center}.stgl-tabs{display:flex;gap:3px;flex-wrap:wrap}.stgl-tabs button{display:flex;gap:7px;align-items:center;border-color:transparent;background:transparent;color:var(--stgl-muted);padding:7px 10px}.stgl-tabs button span{font-size:11px;opacity:1}.stgl-tabs button.active{background:var(--stgl-panel);border-color:var(--stgl-line);color:var(--stgl-ink);box-shadow:0 1px 4px #10182805}.stgl-only-pin{font-size:11px!important;padding:7px 10px!important;background:transparent!important;color:var(--stgl-muted)!important;white-space:nowrap}.stgl-only-pin.active{background:var(--stgl-panel)!important;color:var(--stgl-ink)!important}.stgl-count{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:15px 0 12px;color:var(--stgl-muted);font-size:11px;font-weight:500}.stgl-count>span{opacity:1}
.stgl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,265px),1fr));gap:14px}.stgl-card{border:1px solid var(--stgl-line);background:var(--stgl-panel);border-radius:19px;padding:18px;box-shadow:0 2px 8px #10182803;display:flex;flex-direction:column;gap:12px;transition:border-color 180ms,box-shadow 180ms}.stgl-card:hover{border-color:color-mix(in srgb,var(--stgl-ink) 21%,var(--stgl-panel));box-shadow:0 5px 16px #10182807}.stgl-card.stgl-current{border-color:color-mix(in srgb,#91a6c4 55%,var(--stgl-panel))}.stgl-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:28px}.stgl-card-meta{color:var(--stgl-muted);font-size:11px;font-weight:500}.stgl-badge{font-size:11px;font-weight:500;color:var(--stgl-ink);background:var(--stgl-soft);border-radius:6px;padding:4px 7px}.stgl-card h2{font-size:15px;font-weight:550;margin:0;line-height:1.65;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:46px}.stgl-path{font-size:11px;color:var(--stgl-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}.stgl-fields{display:flex;gap:8px}.stgl-fields label{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}.stgl-fields label:last-child{flex:0 0 84px}.stgl-fields label>span{font-size:11px;font-weight:500;color:var(--stgl-muted)}.stgl-fields :is(input,select){width:100%;padding:7px 8px;font-size:11px;background:var(--stgl-soft);border-color:transparent;border-radius:8px}.stgl-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;padding-top:12px;border-top:1px solid var(--stgl-line)}.stgl-card-bottom button{padding:6px 8px;border-color:transparent;background:transparent;font-size:11px}.stgl-card-bottom button span{padding-left:5px}.stgl-stage{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:var(--stgl-muted)}.stgl-stage i{width:4px;height:4px;background:currentColor;border-radius:50%}.stgl-time{font-size:11px;font-weight:500;color:var(--stgl-muted)}
.stgl-empty{border:1px dashed var(--stgl-line);border-radius:20px;padding:44px 24px;text-align:center;background:var(--stgl-panel);color:var(--stgl-muted)}.stgl-empty>svg{margin-bottom:14px}.stgl-empty h2{color:var(--stgl-ink);font-size:16px;font-weight:550;margin:0 0 10px}.stgl-empty p{max-width:440px;margin:0 auto 20px;font-size:12px;line-height:1.8;font-weight:500}.stgl-note{margin:18px 0;color:var(--stgl-muted);font-size:11px;font-weight:500;line-height:1.8}.stgl-notice{background:var(--stgl-panel);border:1px solid var(--stgl-line);padding:11px 14px;border-radius:12px;font-size:12px;margin-bottom:14px}.stgl-config{margin:0 0 18px;border:1px solid var(--stgl-line);border-radius:16px;padding:16px;background:var(--stgl-panel)}.stgl-config h2{font-size:14px;font-weight:550;margin:0 0 8px}.stgl-config p{color:var(--stgl-muted);font-size:12px;line-height:1.8;margin:0 0 12px}.stgl-config .stgl-toolbar{margin-top:8px}.stgl-config input{flex:1;min-width:180px}.stgl-loading{padding:50px;text-align:center;color:var(--stgl-muted)}
.stgl-download{display:inline-flex;align-items:center;white-space:nowrap;text-decoration:none;border:1px solid var(--stgl-line);border-radius:11px;background:var(--stgl-panel);padding:9px 12px;font-size:12px;font-weight:500;color:var(--stgl-ink)}.stgl-download:hover{background:var(--stgl-soft)}.stgl-heading-actions{flex-wrap:wrap}.stgl-page a:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:2px}@media(max-width:780px){.stgl-page{padding:22px}.stgl-workspace-label{max-width:100%;flex:1}.stgl-workspace{width:100%;max-width:none}.stgl-search{flex-basis:100%;order:3}.stgl-heading-actions{gap:5px}.stgl-heading-actions button{font-size:11px;padding:8px}.stgl-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))}}
@media(max-width:480px){.stgl-page{padding:16px}.stgl-heading{align-items:flex-start;flex-direction:column;gap:12px}.stgl-heading h1{font-size:24px}.stgl-heading-actions{align-self:flex-end}.stgl-filterbar{align-items:flex-start;flex-wrap:wrap}.stgl-tabs button{padding:6px 8px}.stgl-count>span{display:none}.stgl-controls{padding:12px}.stgl-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.stgl-page button,.stgl-card{transition:none}.stgl-page button:is(:hover,:active){transform:none!important}}
`;

// src/client.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var KEY = "dsh-stg-learning.v1";
var APP_KEY = "dsh-stg-learning.app.v1";
var WORKSPACE_KEY = "dsh-stg-learning.workspace.v1";
var STG_DOWNLOAD = "https://github.com/wildcat430524/STG-Desk/releases/latest";
function readMetadata() {
  try {
    return normalizeMetadata(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return normalizeMetadata(null);
  }
}
function useSource(source) {
  const store = (0, import_react.useMemo)(() => ({ subscribe: (f) => source.subscribe(f), get: () => source.getSnapshot() }), [source]);
  return (0, import_react.useSyncExternalStore)(store.subscribe, store.get, store.get);
}
function BookIcon({ size = 18 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V6Z" }) });
}
function SessionCard({ row, update, open, showPath }) {
  const [course, setCourse] = (0, import_react.useState)(row.course);
  const d = new Date(row.updatedAt);
  const when = Number.isNaN(d.getTime()) || d.getTime() <= 0 ? "" : d.toLocaleDateString(void 0, { month: "short", day: "numeric" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "stgl-card" + (row.current ? " stgl-current" : ""), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-card-top", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "stgl-card-meta", children: row.current ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "stgl-badge", children: "\u5F53\u524D\u5BF9\u8BDD" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { children: when || "\u5C1A\u672A\u5F00\u59CB" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "stgl-pin " + (row.pinned ? "stgl-pinned" : ""), title: row.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876\u4F1A\u8BDD", "aria-label": `${row.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876"}\uFF1A${row.title}`, "aria-pressed": row.pinned, onClick: () => update(row.id, { pinned: !row.pinned }), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: row.pinned ? "currentColor" : "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" }) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { title: row.title, children: row.title }),
    showPath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "stgl-path", title: row.cwd, children: row.cwd }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-fields", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5173\u8054\u8BFE\u7A0B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": `${row.title}\u7684\u8BFE\u7A0B`, placeholder: "\u586B\u5199\u8BFE\u7A0B\u540D\u79F0", value: course, maxLength: 200, onChange: (e) => {
          setCourse(e.target.value);
          update(row.id, { course: e.target.value });
        } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5B66\u4E60\u6807\u8BB0" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { "aria-label": `${row.title}\u7684\u5B66\u4E60\u6807\u8BB0`, value: row.stage, onChange: (e) => update(row.id, { stage: e.target.value }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "learning", children: "\u5B66\u4E60\u4E2D" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "review", children: "\u5F85\u590D\u4E60" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "done", children: "\u5DF2\u7ED3\u675F" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-card-bottom", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "stgl-stage", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { "aria-hidden": "true" }),
        { learning: "\u5B66\u4E60\u4E2D", review: "\u5F85\u590D\u4E60", done: "\u5DF2\u7ED3\u675F" }[row.stage]
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { onClick: () => open(row.id), children: [
        "\u7EE7\u7EED\u5BF9\u8BDD ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u2197" })
      ] })
    ] })
  ] });
}
function LearningPanel({ services }) {
  const sessions = useSource(services.sessions.list), workspaces = useSource(services.workspaces.list);
  const [metadata, setMetadata] = (0, import_react.useState)(readMetadata), [selected, setSelected] = (0, import_react.useState)(() => {
    try {
      return localStorage.getItem(WORKSPACE_KEY) || "";
    } catch {
      return "";
    }
  }), [query, setQuery] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)(""), [busy, setBusy] = (0, import_react.useState)(false), [app, setApp] = (0, import_react.useState)(() => {
    try {
      return localStorage.getItem(APP_KEY) || "";
    } catch {
      return "";
    }
  });
  const [stageFilter, setStageFilter] = (0, import_react.useState)("all"), [pinnedOnly, setPinnedOnly] = (0, import_react.useState)(false), [showCollab, setShowCollab] = (0, import_react.useState)(false);
  const metadataRef = (0, import_react.useRef)(metadata);
  metadataRef.current = metadata;
  const items = workspaces.items || [], enabled = items.filter((w) => metadata.workspaces[w.workspaceId]?.enabled);
  const currentWorkspace = items.find((w) => w.sessionIds?.includes(currentSessionId(sessions)));
  const targetId = selected === "*" || items.some((w) => w.workspaceId === selected) ? selected : enabled[0]?.workspaceId || currentWorkspace?.workspaceId || items[0]?.workspaceId || "";
  function selectWorkspace(id) {
    setSelected(id);
    try {
      localStorage.setItem(WORKSPACE_KEY, id);
    } catch {
      setNotice("\u5DE5\u4F5C\u533A\u9009\u62E9\u672A\u4FDD\u5B58\u3002");
    }
  }
  const workspace = items.find((w) => w.workspaceId === targetId);
  const visible = targetId === "*" ? enabled : workspace ? [workspace] : [];
  const allRows = [...new Map(visible.flatMap((w) => learningSessions({ sessions, workspaces, workspaceId: w.workspaceId, metadata, query })).map((r) => [r.id, r])).values()].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt ?? -Infinity) - (a.updatedAt ?? -Infinity));
  const rows = allRows.filter((r) => (stageFilter === "all" || r.stage === stageFilter) && (!pinnedOnly || r.pinned));
  function commit(next) {
    const value = normalizeMetadata(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
      metadataRef.current = value;
      setMetadata(value);
      setNotice("");
    } catch {
      setNotice("\u5B66\u4E60\u6807\u8BB0\u672A\u4FDD\u5B58\uFF1A\u672C\u5730\u5B58\u50A8\u4E0D\u53EF\u7528\u3002\u539F\u4F1A\u8BDD\u548C\u5B66\u4E60\u6587\u6863\u672A\u53D7\u5F71\u54CD\u3002");
    }
  }
  function update(id, patch) {
    const previous = metadataRef.current;
    commit({ ...previous, sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...patch } } });
  }
  async function action(fn) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e?.message || "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  function open(id) {
    action(() => services.uiWorkspace.openSession(id));
  }
  async function create() {
    if (!workspace) return;
    await action(async () => {
      const id = await services.sessions.create({ workspaceId: workspace.workspaceId });
      update(id, { course: "", stage: "learning", pinned: false });
      services.uiWorkspace.openSession(id);
    });
  }
  async function launch() {
    await action(async () => {
      const file = app.trim();
      if (!file || !/\.exe$/i.test(file)) throw Error("\u8BF7\u5148\u586B\u5199 STG Desk \u7684\u5B8C\u6574 exe \u8DEF\u5F84\u3002");
      const result = await services.remote.session.openWorkspacePath({ path: file });
      if (!result.ok) throw Error(result.error.message);
    });
  }
  (0, import_react.useEffect)(() => {
    const listener = (e) => {
      if (e.key === KEY) setMetadata(readMetadata());
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  if (sessions.phase !== "ready" || workspaces.phase !== "ready") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "stgl-loading", children: "\u6B63\u5728\u8BFB\u53D6 DSH \u5DE5\u4F5C\u533A\u4E0E\u4F1A\u8BDD\u2026" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => services.layout.selectPanel(null), children: "\u8FD4\u56DE\u5BF9\u8BDD" })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: "stgl-page", "aria-label": "STG \u5B66\u4E60\u7BA1\u7406", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-inner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "stgl-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-eyebrow", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookIcon, { size: 15 }),
          " STG LEARNING"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "\u5B66\u4E60\u4F1A\u8BDD" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "stgl-subtitle", children: "\u6574\u7406\u8BFE\u7A0B\u4E0E\u5BF9\u8BDD\uFF0C\u4ECE\u4E0A\u6B21\u7684\u8FDB\u5EA6\u7EE7\u7EED\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-heading-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "stgl-download", href: STG_DOWNLOAD, target: "_blank", rel: "noopener noreferrer", children: "\u4E0B\u8F7D STG Desk \u2197" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-expanded": showCollab, "aria-controls": "stgl-collab", onClick: () => setShowCollab(!showCollab), children: "STG \u534F\u4F5C \u2197" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => services.layout.selectPanel(null), children: "\u8FD4\u56DE\u5BF9\u8BDD" })
      ] })
    ] }),
    notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "status", className: "stgl-notice", children: notice }),
    showCollab && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { id: "stgl-collab", className: "stgl-config", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u4E0E STG Desk \u4E00\u8D77\u5B66\u4E60" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5728 STG \u4E2D\u5BFC\u5165\u76F8\u540C\u6587\u4EF6\u5939\u5E76\u9009\u62E9\u540C\u4E00\u4E2A DSH \u4F1A\u8BDD\uFF0C\u5373\u53EF\u7EE7\u7EED\u540C\u6B65\u5BF9\u8BDD\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "stgl-time", htmlFor: "stgl-app", children: "STG Desk \u5E94\u7528\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: "stgl-app", placeholder: "STG Desk.exe \u7684\u5B8C\u6574\u8DEF\u5F84", value: app, onChange: (e) => setApp(e.target.value), onBlur: () => {
          try {
            localStorage.setItem(APP_KEY, app.trim());
          } catch {
            setNotice("\u5E94\u7528\u8DEF\u5F84\u672A\u4FDD\u5B58\u3002");
          }
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy || !app.trim(), onClick: launch, children: "\u6253\u5F00 STG Desk \u2197" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "stgl-controls", "aria-label": "\u4F1A\u8BDD\u7B5B\u9009", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "stgl-workspace-label", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5DE5\u4F5C\u533A" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { className: "stgl-workspace", "aria-label": "\u5B66\u4E60\u5DE5\u4F5C\u533A", value: targetId, onChange: (e) => selectWorkspace(e.target.value), children: [
            (enabled.length > 0 || targetId === "*") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "*", children: "\u5168\u90E8\u5B66\u4E60\u5DE5\u4F5C\u533A" }),
            items.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: w.workspaceId, children: [
              metadata.workspaces[w.workspaceId]?.enabled ? "\u5B66\u4E60 \xB7 " : "",
              w.title || w.path
            ] }, w.workspaceId))
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "stgl-search", "aria-label": "\u641C\u7D22\u5B66\u4E60\u4F1A\u8BDD", placeholder: "\u641C\u7D22\u4F1A\u8BDD\u6216\u8BFE\u7A0B\u2026", value: query, onChange: (e) => setQuery(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "stgl-primary", disabled: busy || !workspace, onClick: create, children: "\uFF0B \u65B0\u4F1A\u8BDD" })
      ] }),
      workspace && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-workspace-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "stgl-time", title: workspace.path, children: workspace.path }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-pressed": !!metadata.workspaces[targetId]?.enabled, onClick: () => commit({ ...metadata, workspaces: { ...metadata.workspaces, [targetId]: { enabled: !metadata.workspaces[targetId]?.enabled } } }), children: metadata.workspaces[targetId]?.enabled ? "\u2713 \u5B66\u4E60\u5DE5\u4F5C\u533A" : "\u8BBE\u4E3A\u5B66\u4E60\u5DE5\u4F5C\u533A" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-filterbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "stgl-tabs", role: "group", "aria-label": "\u5B66\u4E60\u6807\u8BB0\u7B5B\u9009", children: [["all", "\u5168\u90E8"], ["learning", "\u5B66\u4E60\u4E2D"], ["review", "\u5F85\u590D\u4E60"], ["done", "\u5DF2\u7ED3\u675F"]].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { "aria-pressed": stageFilter === id, className: stageFilter === id ? "active" : "", onClick: () => setStageFilter(id), children: [
        label,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: allRows.filter((r) => id === "all" || r.stage === id).length })
      ] }, id)) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "stgl-only-pin" + (pinnedOnly ? " active" : ""), "aria-pressed": pinnedOnly, onClick: () => setPinnedOnly(!pinnedOnly), children: "\u53EA\u770B\u7F6E\u9876" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-count", "aria-live": "polite", children: [
      rows.length,
      " \u4E2A\u4F1A\u8BDD",
      query ? " \xB7 \u641C\u7D22\u7ED3\u679C" : "",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u7F6E\u9876\u4F18\u5148 \xB7 \u6700\u8FD1\u6D3B\u8DC3" })
    ] }),
    rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "stgl-grid", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionCard, { row, update, open, showPath: targetId === "*" }, row.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "stgl-empty", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookIcon, { size: 28 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: query || stageFilter !== "all" || pinnedOnly ? "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u4F1A\u8BDD" : items.length ? "\u5F00\u59CB\u4E00\u6BB5\u65B0\u7684\u5B66\u4E60" : "\u5148\u6DFB\u52A0\u5B66\u4E60\u5DE5\u4F5C\u533A" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: query || stageFilter !== "all" || pinnedOnly ? "\u8BD5\u8BD5\u5176\u4ED6\u5173\u952E\u8BCD\uFF0C\u6216\u8C03\u6574\u4E0A\u65B9\u7B5B\u9009\u3002" : items.length ? "\u5728\u8FD9\u4E2A\u5DE5\u4F5C\u533A\u65B0\u5EFA\u4F1A\u8BDD\uFF0C\u8BB0\u5F55\u8BFE\u7A0B\u4E2D\u7684\u95EE\u9898\u548C\u60F3\u6CD5\u3002" : "\u5728 DSH \u5DE6\u4FA7\u6DFB\u52A0\u4F60\u7684\u5B66\u4E60\u6587\u4EF6\u5939\uFF0C\u518D\u56DE\u5230\u8FD9\u91CC\u3002" }),
      workspace && !query && stageFilter === "all" && !pinnedOnly && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy, onClick: create, children: "\uFF0B \u65B0\u5B66\u4E60\u4F1A\u8BDD" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "stgl-note", children: "\u8BFE\u7A0B\u548C\u9636\u6BB5\u4EC5\u7528\u4E8E\u4E2A\u4EBA\u6574\u7406\uFF0C\u4E0D\u4FEE\u6539\u5B66\u4E60\u6863\u6848\u3002" })
  ] }) });
}
var inject = ["slots", "sessions", "workspaces", "uiWorkspace", "layout", "remote"];
function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-stg-learning";
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  }, "stg-learning: scoped styles");
  const services = { sessions: ctx.sessions, workspaces: ctx.workspaces, uiWorkspace: ctx.uiWorkspace, layout: ctx.layout, remote: ctx.remote };
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: "stg-learning", inject: () => ({ services }) }, LearningPanel));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: "stg-learning", order: 35, label: () => "\u5B66\u4E60" }, BookIcon));
}

return module.exports;}});
