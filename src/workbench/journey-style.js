export const journeyCSS = `
.stgj-root{height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;background:var(--stgw-paper,#fff);color:var(--stgw-ink,#27303d);font:13px/1.65 var(--stgw-font,"Segoe UI","Microsoft YaHei UI",sans-serif)}
.stgj-root *{box-sizing:border-box}
.stgj-header{height:64px;min-height:64px;display:flex;align-items:center;gap:16px;padding:0 24px;border-bottom:1px solid var(--stgw-line)}
.stgj-root button:not(.stgj-conversation *):not(.stgj-documents *){font:inherit;color:inherit;cursor:pointer;background:transparent;border:0;border-radius:8px;padding:7px 10px;display:inline-flex;align-items:center;justify-content:center;gap:7px}
.stgj-root button:not(.stgj-conversation *):not(.stgj-documents *):hover{background:var(--stgw-soft)}
.stgj-root button:focus-visible,.stgj-kickoff :is(summary,textarea):focus-visible{outline:2px solid var(--stgw-accent);outline-offset:3px}
.stgj-root button:disabled{cursor:wait;opacity:.55}
.stgj-brand{display:flex;align-items:center;gap:10px;min-width:0}
.stgj-brand strong{display:block;font-size:13px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
.stgj-brand small{font-size:10px;color:var(--stgw-faint);display:block;line-height:1.4}
.stgj-divider{height:22px;width:1px;background:var(--stgw-line)}
.stgj-tabs{display:flex;gap:3px;padding:3px;background:var(--stgw-soft);border-radius:10px;margin-left:auto}
.stgj-tabs button[aria-selected=true]{background:var(--stgw-bg)!important;box-shadow:0 1px 4px #00000009;color:var(--stgw-ink)}
.stgj-header-actions{display:flex;gap:3px;margin-left:auto}
.stgj-tabs+.stgj-header-actions{margin-left:0}
.stgj-statusline{display:flex;gap:9px;align-items:center;padding:9px 26px;border-bottom:1px solid var(--stgw-line);font-size:11px;color:var(--stgw-muted);min-height:39px}
.stgj-status-dot{width:6px;height:6px;background:var(--stgw-accent);border-radius:50%}
.stgj-body,.stgj-conversation,.stgj-documents{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}
.stgj-documents{height:100%}
.stgj-documents[hidden]{display:none}
.stgj-documents .stgw-header{display:none}
.stgj-documents .stgw-lesson-title{font-size:18px;line-height:1.5;margin:5px 0 10px}
.stgw-progress-details{font-size:12px;margin:0 0 12px;color:var(--stgw-muted)}
.stgw-progress-details>summary{cursor:pointer;width:max-content}
.stgw-progress-details .stgw-evidence{margin:10px 0 0}
.stgj-conversation{width:100%;overflow:hidden}
.stgj-welcome-scroll{overflow:auto;flex:1;min-height:0}
.stgj-welcome{width:100%;max-width:690px;margin-inline:auto;padding:clamp(33px,7vh,70px) clamp(22px,4vw,48px) 42px}
.stgj-welcome h1{font-size:clamp(25px,3.1vw,35px);line-height:1.35;font-weight:600;letter-spacing:-.025em;color:var(--stgw-heading);margin:0}
.stgj-welcome-intro{font-size:14px;color:var(--stgw-muted);margin:10px 0 0}
.stgj-kickoff{margin-top:28px;min-width:0}
.stgj-kickoff label{display:block;font-size:13px;font-weight:550;margin-bottom:9px}
.stgj-kickoff label small{margin-inline-start:6px;font-size:11px;font-weight:400;color:var(--stgw-muted)}
.stgj-kickoff textarea{display:block;resize:vertical;min-height:108px;max-height:280px;width:100%;border:1px solid var(--stgw-line);border-radius:12px;background:var(--stgw-surface,var(--stgw-bg));color:var(--stgw-ink);padding:13px 15px;font:inherit;font-size:14px;line-height:1.8}
.stgj-kickoff textarea::placeholder{color:var(--stgw-muted)}
.stgj-kickoff textarea:focus{border-color:var(--stgw-accent)}
.stgj-kickoff button{font:inherit;cursor:pointer;min-height:36px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--stgw-line);color:var(--stgw-ink);background:var(--stgw-bg);border-radius:8px;padding:7px 13px}
.stgj-kickoff button:hover:not(:disabled){border-color:var(--stgw-accent)}
.stgj-mode-options{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.stgj-mode-options button[aria-pressed=true]{border-color:var(--stgw-accent);color:var(--stgw-accent);background:var(--stgw-active);font-weight:550}
.stgj-kickoff-note{font-size:12px;color:var(--stgw-muted);margin:9px 0 0;line-height:1.75}
.stgj-kickoff-actions{margin-top:21px;display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap}
.stgj-kickoff-actions span{font-size:12px;color:var(--stgw-muted)}
.stgj-kickoff .stgj-primary{background:var(--stgw-ink);border-color:var(--stgw-ink);color:var(--stgw-bg);min-height:42px;padding:9px 16px;font-weight:550}
.stgj-kickoff .stgj-primary:hover:not(:disabled){background:var(--stgw-accent);border-color:var(--stgw-accent)}
.stgj-restart{margin-top:27px;border-top:1px solid var(--stgw-line);padding-top:12px}
.stgj-restart>summary{cursor:pointer;width:fit-content;max-width:100%;font-size:13px;color:var(--stgw-muted);list-style:none;display:flex;align-items:center;gap:8px;border-radius:6px;padding:5px 2px}
.stgj-restart>summary::-webkit-details-marker{display:none}
.stgj-restart>summary::before{content:'';width:6px;height:6px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;rotate:-45deg;transition:rotate 120ms}
.stgj-restart[open]>summary::before{rotate:45deg}
.stgj-restart>summary:hover,.stgj-restart[open]>summary{color:var(--stgw-ink)}
.stgj-restart-note{margin:6px 0 19px;font-size:12px;color:var(--stgw-muted)}
.stgj-kickoff-stale{margin-top:12px}
.stgj-error{padding:11px 22px;color:var(--stgw-danger);font-size:12px;border-bottom:1px solid var(--stgw-line)}
.stgj-loading{padding:45px;color:var(--stgw-muted);text-align:center}
@media(max-width:700px){
  .stgj-header{height:59px;min-height:59px;padding:0 13px;gap:8px;flex-wrap:nowrap}
  .stgj-brand strong{max-width:125px;font-size:12px}
  .stgj-brand small,.stgj-divider,.stgj-header-actions .stgj-action-text,.stgj-library-text{display:none}
  .stgj-tabs{gap:0}.stgj-tabs button{padding:6px 9px!important;font-size:12px!important}
  .stgj-statusline{padding:8px 18px}
}
@media(prefers-reduced-motion:reduce){.stgj-root *,.stgj-root *::before{scroll-behavior:auto!important;transition:none!important}}
`;
