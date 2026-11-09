/** Local learning UI tokens. DSH's own conversation remains entirely host-owned. */
export const experienceCSS = `
/* Reader palette. Light is a white sheet on a barely-tinted canvas; dark has
   its own paper, ink and code surfaces instead of inheriting a grey wash.
   The same tokens feed the workbench, the journey shell and the editor. */
:is(.stgw-root,.stgj-root,.stgt-frame){
  --stgw-paper:#f7f6f2;--stgw-canvas:#f0efeb;--stgw-ink:#35342f;--stgw-heading:#24231f;
  --stgw-muted:#706e65;--stgw-faint:#88857c;--stgw-line:#dedcd4;--stgw-soft:#eeede7;
  --stgw-accent:#526457;--stgw-active:color-mix(in srgb,var(--stgw-accent) 8%,var(--stgw-paper));
  --stgw-code-bg:#faf9f5;--stgw-code-toolbar:#efeee8;--stgw-code-line:#e0ded6;
  --stgw-reader-paper:#fcfbf7;--stgw-reader-canvas:#f1efe8;--stgw-reader-ink:#272b24;
  --stgw-reader-heading:#202a23;--stgw-reader-accent:#4d6655;--stgw-reader-line:#d9dcd0;
  --stgw-sample-bg:#f1f4ee;--stgw-sample-bar:#e8eee4;--stgw-sample-line:#cdd8cb;
  --stgw-sample-ink:#26352d;--stgw-sample-muted:#4e6054;--stgw-sample-focus:#41644e;
  --stgw-sample-keyword:#79457e;--stgw-sample-string:#35653e;--stgw-sample-number:#78521f;
  --stgw-sample-title:#2e5b87;--stgw-sample-name:#94464a;--stgw-sample-scroll:#889d90;
  --stgw-warn:#a06921;--stgw-danger:#c14545;
  --stgw-selection-bg:#ead3c3;--stgw-selection-ink:#35302b;
  --stgw-font:"Segoe UI Variable Text","Microsoft YaHei","PingFang SC","Microsoft YaHei UI","Hiragino Sans GB",system-ui,sans-serif;
  --stgw-mono:"Cascadia Code",Consolas,"SFMono-Regular",ui-monospace,monospace;
  --stgw-bg:var(--stgw-paper);--stgw-surface:var(--stgw-paper);
  font-family:var(--stgw-font);font-weight:400;letter-spacing:.005em;color-scheme:light
}
:is(html[data-theme=dark],html[data-app-theme=dark]) :is(.stgw-root,.stgj-root,.stgt-frame),
body[data-ds-dark-theme] :is(.stgw-root,.stgj-root,.stgt-frame),
html[data-ds-dark-theme] :is(.stgw-root,.stgj-root,.stgt-frame),
:is(.stgw-root,.stgj-root,.stgt-frame):where(.stgw-dark,[data-theme=dark],[data-ds-dark-theme]){
  --stgw-paper:#1b1f26;--stgw-canvas:#15181d;--stgw-ink:#cdd5e0;--stgw-heading:#eef2f7;
  --stgw-muted:#98a2b1;--stgw-faint:#7e8896;--stgw-line:#2c333d;--stgw-soft:#242a33;
  --stgw-accent:#7ba0ef;--stgw-active:color-mix(in srgb,var(--stgw-accent) 14%,var(--stgw-paper));
  --stgw-code-bg:#20252d;--stgw-code-toolbar:#242a33;--stgw-code-line:#303844;
  --stgw-reader-paper:#1e2526;--stgw-reader-canvas:#151a1b;--stgw-reader-ink:#d5ded9;
  --stgw-reader-heading:#eef4f0;--stgw-reader-accent:#a4bdad;--stgw-reader-line:#394542;
  --stgw-sample-bg:#24312c;--stgw-sample-bar:#2d3b34;--stgw-sample-line:#4a5a51;
  --stgw-sample-ink:#edf1e9;--stgw-sample-muted:#b8c8bd;--stgw-sample-focus:#b4d4ba;
  --stgw-sample-keyword:#e6bbdf;--stgw-sample-string:#b5d891;--stgw-sample-number:#eac08d;
  --stgw-sample-title:#a0d0e6;--stgw-sample-name:#ffb1a9;--stgw-sample-scroll:#687d72;
  --stgw-selection-bg:#655043;--stgw-selection-ink:#fff4e8;
  --stgw-warn:#d6a45f;--stgw-danger:#ef8a8a;color-scheme:dark
}
/* Apply to descendants too, so code syntax and editable text share the same
   readable selection instead of falling back to the platform's blue fill. */
:is(.stgw-root,.stgj-root,.stgt-frame)::selection,
:is(.stgw-root,.stgj-root,.stgt-frame) ::selection{
  background-color:var(--stgw-selection-bg);color:var(--stgw-selection-ink);text-shadow:none
}
@media(forced-colors:active){
  :is(.stgw-root,.stgj-root,.stgt-frame)::selection,
  :is(.stgw-root,.stgj-root,.stgt-frame) ::selection{background-color:Highlight;color:HighlightText}
}
:is(.stgw-root,.stgj-root,.stgw-onboarding){--stgw-space-1:4px;--stgw-space-2:8px;--stgw-space-3:12px;--stgw-space-4:16px;--stgw-space-6:24px;--stgw-space-8:32px;--stgw-space-12:48px;--stgw-radius-control:8px;--stgw-radius-panel:12px;--stgw-control-height:32px;--stgw-gutter:clamp(20px,3vw,40px);--stgw-reading-width:896px;--stgw-ease:cubic-bezier(.2,.9,.22,1);--stgw-motion-fast:140ms;--stgw-motion-normal:220ms}
.stgw-root button:not(.stgw-mentor-native-content *){min-height:var(--stgw-control-height);border-radius:var(--stgw-radius-control);transition:background-color var(--stgw-motion-fast),color var(--stgw-motion-fast),border-color var(--stgw-motion-fast),box-shadow var(--stgw-motion-fast)}
.stgw-root button:not(.stgw-mentor-native-content *):active:not(:disabled){background:var(--stgw-active)}
.stgw-root .stgw-icon{width:32px!important;height:32px!important}
.stgw-root .stgw-document-access{gap:18px;min-height:40px;padding:0 var(--stgw-gutter);background:var(--stgw-paper);border-bottom:1px solid var(--stgw-line)}
.stgw-root .stgw-access-label{display:none}
.stgw-page-tabs{position:relative;align-items:stretch;gap:16px!important;scrollbar-width:none!important}
.stgw-page-tabs::-webkit-scrollbar{display:none}
.stgw-root .stgw-page-tabs>button{min-height:40px;padding:8px 4px;border:0;border-radius:0;background:transparent;font-size:12px}
.stgw-root .stgw-page-tabs button[aria-pressed=true]{border:0;background:transparent;color:var(--stgw-ink);font-weight:550}
.stgw-root .stgw-course-picker{height:30px;max-width:200px;border-radius:8px;font-size:11px;background:var(--stgw-paper)}
.stgw-sliding-indicator{position:absolute;pointer-events:none;z-index:0;visibility:hidden;transition:left var(--stgw-motion-normal) var(--stgw-ease),width var(--stgw-motion-normal) var(--stgw-ease)}
.stgw-sliding-indicator[data-ready=true]{visibility:visible}.stgw-indicator-line{height:2px;bottom:0;border-radius:2px;background:var(--stgw-accent)}
.stgw-root .stgw-tabs{position:relative;isolation:isolate;padding:3px;gap:2px;border:1px solid var(--stgw-line);background:var(--stgw-soft);border-radius:10px}
.stgw-root .stgw-tabs button{position:relative;z-index:1;min-height:28px;font-size:11px;border:0;background:transparent!important;box-shadow:none!important;padding:5px 14px}
.stgw-indicator-pill{top:3px;bottom:3px;border-radius:6px;background:var(--stgw-paper);box-shadow:0 1px 3px #0000000c}
.stgw-root .stgw-main-tools{min-height:44px;padding:5px var(--stgw-gutter);gap:12px;background:var(--stgw-paper);border-bottom:1px solid var(--stgw-line)}
.stgw-root .stgw-doc-actions{gap:4px;min-width:0}
.stgw-root .stgw-scroll{background:var(--stgw-canvas);scrollbar-gutter:stable}
.stgw-root .stgw-save-state{display:inline-flex;align-items:center;gap:5px;min-width:66px;font-size:10px;color:var(--stgw-faint)}
.stgw-save-state[data-state=dirty]{color:var(--stgw-warn)}.stgw-draft-dot{width:4px;height:4px;border-radius:50%;background:currentColor}
.stgw-save-check{stroke-dasharray:18;stroke-dashoffset:0;animation:stgw-check-in 220ms var(--stgw-ease)}
.stgw-spinner{display:inline-block;width:12px;height:12px;border:1.5px solid var(--stgw-line);border-top-color:currentColor;border-radius:50%;animation:stgw-spin .85s linear infinite;flex-shrink:0}
.stgw-spinning{animation:stgw-spin .85s linear infinite}
/* One paper column, not a card per paragraph. Its inner measure stays near
   760px at desktop width and narrows with the docked teacher panel. */
.stgw-root .stgw-content,.stgw-root .stgw-progress-page{width:100%;max-width:var(--stgw-reading-width);margin:18px auto;padding:clamp(24px,2.8vw,34px) clamp(24px,4.4vw,68px) 64px;background:var(--stgw-paper);border:0;border-radius:0;box-shadow:none;box-sizing:border-box}
.stgw-root .stgw-lesson-eyebrow{font-size:10.5px;line-height:1.5;margin-bottom:4px;color:var(--stgw-faint)}
.stgw-root .stgw-lesson-heading{margin-bottom:4px}
.stgw-root .stgw-lesson-heading .stgw-lesson-title{font-size:15px;line-height:1.5;font-weight:500;letter-spacing:0;margin:0!important;color:var(--stgw-muted);overflow-wrap:anywhere}
.stgw-root .stgw-file-label{gap:8px;font-size:10px;line-height:1.6;margin-bottom:22px}
.stgw-root .stgw-file-label>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stgw-root .stgw-file-label>button{min-height:28px;flex-shrink:0;font-size:10px}
.stgw-root .stgw-markdown{font-size:15px;line-height:1.85;color:var(--stgw-ink)}
.stgw-root .stgw-markdown h1{font-size:28px;line-height:1.4;letter-spacing:-.02em;margin:0 0 22px;font-weight:600;color:var(--stgw-heading);overflow-wrap:anywhere}
.stgw-root .stgw-markdown h2{font-size:24px;line-height:1.45;letter-spacing:-.01em;margin:32px 0 14px;font-weight:600;color:var(--stgw-heading)}
.stgw-root .stgw-markdown h3{font-size:19px;line-height:1.55;margin:26px 0 10px;font-weight:600;color:var(--stgw-heading)}
.stgw-reader-header{display:contents}
.stgw-root .stgw-scroll[data-reading=true]{background:var(--stgw-reader-canvas)}
.stgw-root .stgw-scroll[data-reading=true]>.stgw-content{
  --stgw-ink:var(--stgw-reader-ink);--stgw-heading:var(--stgw-reader-heading);
  --stgw-accent:var(--stgw-reader-accent);--stgw-line:var(--stgw-reader-line);
  --stgw-soft:color-mix(in srgb,var(--stgw-accent) 7%,var(--stgw-reader-paper));--stgw-code-line:var(--stgw-line);
  --stgw-font:"Segoe UI Variable Text","Noto Sans SC","Microsoft YaHei UI","PingFang SC",system-ui,sans-serif;
  --stgw-mono:"Cascadia Mono","SFMono-Regular",Consolas,"Noto Sans SC","Microsoft YaHei UI","PingFang SC",monospace;
  background:var(--stgw-reader-paper);color:var(--stgw-ink);font-family:var(--stgw-font)
}
.stgw-scroll[data-reading=true]>.stgw-content>:is(.stgw-reader-header,.stgw-rich,.stgw-markdown,.stgw-source,.stgw-bottom-hint){
  max-inline-size:720px;margin-inline:auto
}
.stgw-root .stgw-scroll[data-reading=true] .stgw-reader-header{
  display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;column-gap:16px;row-gap:2px;
  margin-bottom:24px;padding-bottom:10px;border-bottom:1px solid var(--stgw-line)
}
.stgw-root .stgw-scroll[data-reading=true] .stgw-lesson-heading{grid-area:1/1;margin:0;min-width:0}
.stgw-root .stgw-scroll[data-reading=true] .stgw-lesson-heading .stgw-lesson-title{
  color:var(--stgw-ink);font-size:13px;font-weight:600
}
.stgw-root .stgw-scroll[data-reading=true] .stgw-lesson-eyebrow{grid-area:1/2;margin:0;font-size:11px;color:var(--stgw-muted)}
.stgw-root .stgw-scroll[data-reading=true] :is(.stgw-file-label,.stgw-lesson-context){grid-column:1/-1;margin:0}
.stgw-root .stgw-scroll[data-reading=true] .stgw-file-label{font-size:11px;color:var(--stgw-muted)}
.stgw-root .stgw-scroll[data-reading=true] .stgw-file-label>button{font-size:11px;color:var(--stgw-accent)}
.stgw-scroll[data-reading=true] .stgw-content:has(.visual-document:focus-visible) .stgw-reader-header{
  border-bottom-color:var(--stgw-accent)
}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-content>.stgw-markdown){
  font-size:16px;line-height:1.78;letter-spacing:0
}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) h1{
  font-size:clamp(27px,2.3vw,33px);line-height:1.32;letter-spacing:-.01em;margin:0 0 .66em
}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) h2{
  font-size:22px;line-height:1.42;margin:1.55em 0 .52em
}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) h3{
  font-size:18px;line-height:1.45;margin:1.28em 0 .48em
}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown)>:first-child{margin-top:0}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) p{margin-bottom:.86em}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) li>p{margin-bottom:.28em}
.stgw-scroll[data-reading=true] .visual-document ul[data-type=taskList]>li p{margin:0}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) blockquote{
  margin:1.2em 0;padding:.64em .9em;border:0;border-inline-start:2px solid var(--stgw-accent);
  border-radius:0 6px 6px 0;background:var(--stgw-soft);color:var(--stgw-ink)
}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) blockquote p:last-child{margin-bottom:0}
/* The toolbar and source share a code palette that follows the reader theme. */
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) pre{
  background:var(--stgw-sample-bg);border-color:var(--stgw-sample-line);color:var(--stgw-sample-ink);
  font-family:var(--stgw-mono);font-variant-ligatures:none;font-size:14px;line-height:1.68;padding:13px 16px 15px;
  white-space:pre;overflow-wrap:normal;word-break:normal;
  scrollbar-width:thin;scrollbar-color:var(--stgw-sample-scroll) var(--stgw-sample-bg)
}
.stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) pre code{
  color:inherit;font-family:inherit;font-variant-ligatures:inherit;white-space:inherit;overflow-wrap:inherit;word-break:inherit
}
.stgw-root .stgw-scroll[data-reading=true] .edh-code-tools{
  min-height:31px;padding:3px 7px 3px 10px;
  border-color:var(--stgw-sample-line);border-bottom:1px solid var(--stgw-sample-line);background:var(--stgw-sample-bar)
}
.stgw-root .stgw-scroll[data-reading=true] .edh-code-tools :is(.edh-code-language,.edh-code-copy){
  --dsw-focus-ring-color:var(--stgw-sample-focus);color:var(--stgw-sample-ink);font-size:11px;font-weight:500
}
.stgw-root .stgw-scroll[data-reading=true] .edh-code-tools :is(.edh-code-language,.edh-code-copy):hover{
  --stgw-ink:var(--stgw-sample-ink);--stgw-code-line:var(--stgw-sample-line)
}
.stgw-root .stgw-scroll[data-reading=true] .edh-code-tools .edh-code-copy[data-state=copied]{color:var(--stgw-sample-string)!important}
.stgw-root .stgw-scroll[data-reading=true] .edh-code-tools .edh-code-copy[data-state=failed]{color:var(--stgw-sample-name)!important}
.stgw-scroll[data-reading=true] .visual-document pre :is(.hljs-comment,.hljs-quote){color:var(--stgw-sample-muted)}
.stgw-scroll[data-reading=true] .visual-document pre :is(.hljs-keyword,.hljs-doctag,.hljs-formula){color:var(--stgw-sample-keyword)}
.stgw-scroll[data-reading=true] .visual-document pre :is(.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute){color:var(--stgw-sample-string)}
.stgw-scroll[data-reading=true] .visual-document pre :is(.hljs-number,.hljs-type,.hljs-attr,.hljs-variable){color:var(--stgw-sample-number)}
.stgw-scroll[data-reading=true] .visual-document pre :is(.hljs-title,.hljs-built_in,.hljs-literal){color:var(--stgw-sample-title)}
.stgw-scroll[data-reading=true] .visual-document pre :is(.hljs-name,.hljs-deletion,.hljs-selector-tag){color:var(--stgw-sample-name)}
@media(max-width:570px){
  .stgw-root .stgw-scroll[data-reading=true] .stgw-reader-header{grid-template-columns:minmax(0,1fr);margin-bottom:20px}
  .stgw-root .stgw-scroll[data-reading=true] .stgw-lesson-eyebrow{grid-area:2/1}
  .stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-content>.stgw-markdown){font-size:15.5px}
  .stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) h1{font-size:25px}
  .stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) h2{font-size:20px}
  .stgw-root .stgw-scroll[data-reading=true] :is(.visual-document,.stgw-markdown) pre{font-size:13px;padding-inline:13px}
}
.stgw-root .stgw-question{margin-bottom:32px;padding-bottom:32px}
.stgw-root .stgw-question textarea{border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.8;background:var(--stgw-paper);transition:border-color var(--stgw-motion-fast),box-shadow var(--stgw-motion-fast)}
.stgw-root .stgw-question textarea:focus{border-color:var(--stgw-accent);box-shadow:0 0 0 3px var(--stgw-active)}
.stgw-root .stgw-answer-footer>button{min-width:92px}
.stgw-root .stgw-round-menu{box-shadow:0 12px 38px #00000014,0 2px 6px #00000008;border-radius:var(--stgw-radius-panel)}
.stgw-root .stgw-round-menu:popover-open{animation:stgw-pop-in var(--stgw-motion-fast) var(--stgw-ease)}
.stgw-root .stgw-round-menu button{font-family:inherit}
.stgw-reading-skeleton{width:100%;max-width:var(--stgw-reading-width);margin:18px auto;padding:24px var(--stgw-gutter) 72px;background:var(--stgw-paper);border:1px solid var(--stgw-line);border-radius:16px;box-sizing:border-box}
.stgw-reading-skeleton>div{border-radius:4px;background:var(--stgw-soft);animation:stgw-breathe 1.8s ease-in-out infinite}
.stgw-skeleton-eyebrow{width:90px;height:16px;margin-bottom:8px}.stgw-skeleton-title{width:48%;height:30px;margin-bottom:8px}.stgw-skeleton-file{width:62%;height:28px;margin-bottom:28px}.stgw-skeleton-heading{width:80%;height:38px;margin-bottom:24px}.stgw-skeleton-line{height:16px;margin:12px 0}.stgw-skeleton-short{width:65%}
.stgw-root .stgw-library-inner{width:min(896px,100%);padding:48px var(--stgw-gutter) 32px}
.stgw-root .stgw-library-card{border-radius:var(--stgw-radius-panel);gap:16px;padding:24px;background:var(--stgw-paper)!important;transition:border-color var(--stgw-motion-fast),box-shadow var(--stgw-motion-fast)}
.stgw-root .stgw-library-card:hover{border-color:color-mix(in srgb,var(--stgw-accent) 25%,var(--stgw-line))}
.stgw-root .stgw-library-card:first-child{border-color:var(--stgw-line)}
.stgw-root .stgw-library-symbol{width:36px;height:36px;border-radius:10px;background:var(--stgw-soft);border:0}
.stgw-root .stgw-learning-space{padding:18px 12px;border-radius:8px}.stgw-root .stgw-learning-space small{font-size:10px;margin-top:4px}
.stgj-root{font-family:inherit}
.stgj-root .stgj-header{height:52px;min-height:52px;padding:0 var(--stgw-gutter);gap:16px;background:var(--stgw-paper);border-bottom:1px solid var(--stgw-line)}
.stgj-root .stgj-brand strong{display:block;max-width:min(40vw,360px)}
.stgj-root .stgj-kickoff{background:var(--stgw-paper);border-radius:var(--stgw-radius-panel);padding:24px}
.stgj-root .stgj-mode-options button{border-radius:var(--stgw-radius-control)!important}
.stgj-root .stgj-welcome{max-width:840px;padding:48px var(--stgw-gutter)}
@keyframes stgw-pop-in{from{opacity:0;translate:0 -4px}to{opacity:1;translate:0 0}}
@keyframes stgw-spin{to{rotate:360deg}}@keyframes stgw-check-in{from{stroke-dashoffset:18}to{stroke-dashoffset:0}}@keyframes stgw-breathe{50%{opacity:.5}}
.stgw-onboarding{background:var(--stgwo-bg)}
.stgw-onboarding .stgw-onboarding-card{border-radius:var(--stgw-radius-panel);box-shadow:none;background:var(--stgwo-bg);padding:24px}
.stgw-onboarding button{transition:background-color var(--stgw-motion-fast),border-color var(--stgw-motion-fast);border-radius:var(--stgw-radius-control)}
@supports (interpolate-size:allow-keywords) and selector(details::details-content){
 .stgw-root :is(.stgw-record,.stgw-previous){interpolate-size:allow-keywords}
 .stgw-root :is(.stgw-record,.stgw-previous)::details-content{block-size:0;overflow:clip;transition:block-size var(--stgw-motion-normal) var(--stgw-ease),content-visibility var(--stgw-motion-normal) allow-discrete}
 .stgw-root :is(.stgw-record,.stgw-previous)[open]::details-content{block-size:auto}
}
@media(max-width:700px){.stgw-root .stgw-document-access{gap:8px;padding:0 16px;flex-wrap:wrap}.stgw-page-tabs{flex-basis:100%;gap:12px!important}.stgw-root .stgw-course-picker{margin:0 0 8px auto;max-width:100%;height:28px}.stgw-root .stgw-main-tools{padding:7px 16px;min-height:46px;gap:8px}.stgw-root .stgw-tabs button{min-width:40px;padding:5px 10px}.stgw-root .stgw-save-state{display:none}.stgw-root .stgw-content,.stgw-root .stgw-progress-page{max-width:none;margin:0;padding:22px 20px 48px;border:0;border-radius:0;box-shadow:none}.stgw-root .stgw-reading-skeleton{padding:20px 22px 48px;margin:0;border:0;border-radius:0}.stgw-root .stgw-lesson-heading .stgw-lesson-title{font-size:15px}.stgw-root .stgw-markdown h1{font-size:25px}.stgw-root .stgw-markdown h2{font-size:22px}.stgw-root .stgw-markdown h3{font-size:18.5px}.stgw-root .stgw-library-inner{padding:28px 22px}.stgw-root .stgw-library-card{padding:20px}.stgj-root .stgj-header{padding:0 16px}.stgj-root .stgj-welcome{padding:28px 22px}.stgj-root .stgj-kickoff{padding:20px}}
@media(prefers-reduced-motion:reduce){:is(.stgw-root,.stgj-root,.stgw-onboarding) *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media(forced-colors:active){.stgw-sliding-indicator{background:Highlight}.stgw-root .stgw-page-tabs button[aria-pressed=true]{outline:1px solid Highlight;outline-offset:-3px}.stgw-spinner{border-top-color:Highlight}}
`;
