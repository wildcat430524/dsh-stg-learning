/** App-scoped handoff: only DSH's main composer consumes requests. */
export function createMentorDraftMailbox({ timeoutMs = 12000 } = {}) {
  let sequence = 0, state = { pending: new Map(), notices: new Map() };
  const listeners = new Set(), waiting = new Map();
  const publish = () => { for (const listener of listeners) listener(); };
  function finish(sessionId, id, error, message) {
    const request = state.pending.get(sessionId), receipt = waiting.get(id);
    if (request?.id !== id || !receipt) return false;
    clearTimeout(receipt.timer); waiting.delete(id);
    const pending = new Map(state.pending), notices = new Map(state.notices);
    pending.delete(sessionId); notices.set(sessionId, { id, error: error?.message || '', message: error ? '草稿未能准备，请检查输入框后重试。' : message || '请求已放入 DSH 输入框，请检查后发送。' });
    state = { pending, notices }; publish();
    if (error) receipt.reject(error); else receipt.resolve();
    return true;
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    enqueue(sessionId, text, { intent } = {}) {
      const previous = state.pending.get(sessionId);
      if (previous) {
        if (previous.text === text && previous.intent === intent) return { id: previous.id, ready: waiting.get(previous.id).ready };
        throw Error('导师输入框还有一条待准备请求，请先完成它。');
      }
      const id = `stg-request-${Date.now()}-${++sequence}`;
      let resolve, reject;
      const ready = new Promise((yes, no) => { resolve = yes; reject = no; });
      const timer = setTimeout(() => finish(sessionId, id, Error('原生输入框未在时限内就绪，原有草稿未覆盖。请返回学习内容重试。')), timeoutMs);
      waiting.set(id, { ready, resolve, reject, timer });
      const pending = new Map(state.pending), notices = new Map(state.notices);
      pending.set(sessionId, { id, sessionId, text, intent }); notices.delete(sessionId);
      state = { pending, notices }; publish();
      return { id, ready };
    },
    complete: (sessionId, id, message) => finish(sessionId, id, undefined, message),
    fail: (sessionId, id, error) => finish(sessionId, id, error),
    dismiss(sessionId) { if (state.pending.has(sessionId) || !state.notices.has(sessionId)) return; const notices = new Map(state.notices); notices.delete(sessionId); state = { ...state, notices }; publish(); },
    dispose() { for (const request of [...state.pending.values()]) finish(request.sessionId, request.id, Error('学习插件已卸载，请在原生会话中继续。')); listeners.clear(); },
  };
}
