/* New learning page — every rule stays under .stgw-onboarding so the
   native DSH conversation and other workbench views are untouched. */
export const newLearningCSS = `
.stgw-onboarding{
  --stgwo-bg:var(--dsw-alias-bg-base,#fff);
  --stgwo-surface:var(--dsw-alias-bg-layer-2,var(--stgwo-bg));
  --stgwo-ink:var(--dsw-alias-label-primary,#24262b);
  --stgwo-muted:var(--dsw-alias-label-secondary,color-mix(in srgb,var(--stgwo-ink) 62%,var(--stgwo-bg)));
  --stgwo-faint:var(--dsw-alias-label-tertiary,color-mix(in srgb,var(--stgwo-ink) 42%,var(--stgwo-bg)));
  --stgwo-line:var(--dsw-alias-border-l3,color-mix(in srgb,var(--stgwo-ink) 12%,var(--stgwo-bg)));
  --stgwo-soft:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--stgwo-ink) 4%,var(--stgwo-bg)));
  --stgwo-accent:var(--dsw-alias-state-business-primary,#3269d5);
  --stgwo-active:color-mix(in srgb,var(--stgwo-accent) 7%,var(--stgwo-bg));
  --stgwo-danger:var(--dsw-alias-state-error-primary,#bb4040);
  position:relative;isolation:isolate;width:100%;height:100%;min-width:0;min-height:100%;overflow:auto;
  background:
    radial-gradient(1100px 460px at 12% -8%,var(--stgwo-active),transparent 62%),
    radial-gradient(900px 420px at 108% 0%,color-mix(in srgb,var(--stgwo-accent) 5%,transparent),transparent 58%),
    var(--stgwo-bg);
  color:var(--stgwo-ink);
  font-family:inherit;font-size:14px;line-height:1.65;color-scheme:light dark;
}
.stgw-onboarding *{box-sizing:border-box}
.stgw-onboarding-shell{width:min(1120px,100%);margin:0 auto;padding:30px 40px 34px;display:flex;flex-direction:column;gap:52px;min-height:100%}
.stgw-onboarding-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.stgw-onboarding-brand{display:flex;align-items:center;gap:11px;min-width:0}
.stgw-onboarding-brand-mark{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--stgwo-line);border-radius:10px;color:var(--stgwo-accent);background:var(--stgwo-surface)}
.stgw-onboarding-brand span:last-child{display:flex;flex-direction:column;line-height:1.35;min-width:0}
.stgw-onboarding-brand strong{font-size:13px;font-weight:550;letter-spacing:.01em}
.stgw-onboarding-brand small{font-size:10px;color:var(--stgwo-faint);letter-spacing:.1em}
.stgw-onboarding button{font:inherit}
.stgw-onboarding-back{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:6px 12px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--stgwo-muted);font-size:12px;cursor:pointer;transition:background .16s ease,color .16s ease}
.stgw-onboarding-back:hover:not(:disabled){background:var(--stgwo-soft);color:var(--stgwo-ink)}
.stgw-onboarding-back:disabled{cursor:default;opacity:.45}
.stgw-onboarding-layout{display:grid;grid-template-columns:minmax(0,1.22fr) minmax(0,.82fr);gap:clamp(30px,5vw,78px);align-items:start;flex:1;min-width:0}
.stgw-onboarding-main{min-width:0;padding-top:22px;max-width:620px}
.stgw-onboarding-eyebrow{margin:0 0 16px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--stgwo-faint)}
.stgw-onboarding h1{margin:0 0 18px;font-size:clamp(28px,3.4vw,40px);line-height:1.28;font-weight:550;letter-spacing:-.035em;max-width:15em;text-wrap:balance}
.stgw-onboarding-intro{margin:0 0 36px;font-size:14px;line-height:1.9;color:var(--stgwo-muted);max-width:34em}
.stgw-onboarding-card{display:flex;flex-direction:column;gap:20px;padding:28px;border:1px solid var(--stgwo-line);border-radius:16px;background:color-mix(in srgb,var(--stgwo-surface) 88%,transparent);box-shadow:0 1px 2px #00000005,0 18px 50px #00000008;min-width:0}
.stgw-onboarding-field{display:flex;flex-direction:column;gap:9px;min-width:0}
.stgw-onboarding-label-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.stgw-onboarding-field label{font-size:13px;font-weight:550;letter-spacing:.005em;color:var(--stgwo-ink)}
.stgw-onboarding-required{font-size:10px;letter-spacing:.08em;color:var(--stgwo-faint);border:1px solid var(--stgwo-line);border-radius:999px;padding:2px 8px;line-height:1.5}
.stgw-onboarding-field input{width:100%;min-width:0;padding:13px 15px;border:1px solid var(--stgwo-line);border-radius:10px;background:var(--stgwo-bg);color:var(--stgwo-ink);font:inherit;font-size:14px;line-height:1.5;outline:none;transition:border-color .16s ease,box-shadow .16s ease}
.stgw-onboarding-field input::placeholder{color:var(--stgwo-faint)}
.stgw-onboarding-field input:hover:not(:disabled){border-color:color-mix(in srgb,var(--stgwo-ink) 22%,var(--stgwo-bg))}
.stgw-onboarding-field input:focus{border-color:var(--stgwo-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--stgwo-accent) 14%,transparent)}
.stgw-onboarding-field input:disabled{background:var(--stgwo-soft);color:var(--stgwo-muted);cursor:wait}
.stgw-onboarding-field[data-invalid=true] input{border-color:var(--stgwo-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--stgwo-danger) 11%,transparent)}
.stgw-onboarding-help{margin:0;font-size:11.5px;line-height:1.75;color:var(--stgwo-faint)}
.stgw-onboarding-field-error{margin:0;font-size:12px;line-height:1.7;color:var(--stgwo-danger)}
.stgw-onboarding-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:2px}
.stgw-onboarding-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 20px;border:1px solid transparent;border-radius:10px;background:var(--dsw-alias-button-primary-fill,var(--stgwo-ink));color:var(--dsw-alias-label-primary-foreground,var(--stgwo-bg));font-size:13px;font-weight:550;letter-spacing:.005em;cursor:pointer;transition:filter .16s ease,opacity .16s ease}
.stgw-onboarding-primary:hover:not(:disabled){filter:brightness(1.1)}
.stgw-onboarding-primary:disabled{opacity:.62;cursor:wait}
.stgw-onboarding-primary[data-pending=true]{min-width:250px}
.stgw-onboarding-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 16px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--stgwo-muted);font-size:12.5px;cursor:pointer;transition:background .16s ease,color .16s ease}
.stgw-onboarding-secondary:hover:not(:disabled){background:var(--stgwo-soft);color:var(--stgwo-ink)}
.stgw-onboarding-secondary:disabled{cursor:default;opacity:.42}
.stgw-onboarding button:focus-visible,.stgw-onboarding input:focus-visible,.stgw-onboarding a:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--stgwo-accent));outline-offset:3px}
.stgw-onboarding input:focus-visible{outline-offset:2px}
.stgw-onboarding-status{margin:0;padding:12px 14px;border:1px solid var(--stgwo-line);border-radius:10px;background:var(--stgwo-soft);font-size:12px;line-height:1.8;color:var(--stgwo-muted)}
.stgw-onboarding-alert{display:flex;flex-direction:column;gap:9px;padding:15px 16px;border:1px solid color-mix(in srgb,var(--stgwo-danger) 32%,var(--stgwo-line));border-radius:10px;background:color-mix(in srgb,var(--stgwo-danger) 5%,var(--stgwo-bg));min-width:0}
.stgw-onboarding-alert-message{margin:0;font-size:12.5px;line-height:1.8;color:var(--stgwo-danger);overflow-wrap:anywhere}
.stgw-onboarding-created-path{margin:0;font-size:11.5px;line-height:1.8;color:var(--stgwo-muted);overflow-wrap:anywhere}
.stgw-onboarding-created-path code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;padding:2px 5px;border-radius:4px;background:var(--stgwo-soft);color:var(--stgwo-ink);overflow-wrap:anywhere}
.stgw-onboarding-alert-hint{margin:0;font-size:11px;line-height:1.75;color:var(--stgwo-faint)}
.stgw-onboarding-spinner{width:13px;height:13px;border-radius:50%;border:1.5px solid currentColor;border-top-color:transparent;animation:stgwo-spin .8s linear infinite;flex-shrink:0}
.stgw-onboarding-aside{min-width:0;padding-top:24px;display:flex;flex-direction:column;gap:20px}
.stgw-onboarding-aside h2{margin:0;font-size:16px;font-weight:550;letter-spacing:-.015em}
.stgw-onboarding-aside .stgw-onboarding-eyebrow{margin:0}
.stgw-onboarding-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0;border-top:1px solid var(--stgwo-line)}
.stgw-onboarding-steps li{display:flex;gap:15px;align-items:flex-start;padding:18px 0;border-bottom:1px solid var(--stgwo-line);min-width:0}
.stgw-onboarding-step-number{flex-shrink:0;width:26px;padding-top:2px;font-size:10.5px;letter-spacing:.08em;color:var(--stgwo-faint);font-variant-numeric:tabular-nums}
.stgw-onboarding-steps h3{margin:0 0 5px;font-size:13px;font-weight:550;line-height:1.6;color:var(--stgwo-ink)}
.stgw-onboarding-steps p{margin:0;font-size:12px;line-height:1.8;color:var(--stgwo-muted)}
.stgw-onboarding-aside-note{display:flex;gap:9px;align-items:flex-start;padding:14px 15px;border:1px solid var(--stgwo-line);border-radius:11px;background:var(--stgwo-soft);color:var(--stgwo-muted)}
.stgw-onboarding-aside-note svg{flex-shrink:0;margin-top:2px;color:var(--stgwo-accent)}
.stgw-onboarding-aside-note span{font-size:11.5px;line-height:1.8}
.stgw-onboarding-footer{display:flex;align-items:center;justify-content:space-between;gap:10px 24px;flex-wrap:wrap;padding-top:18px;border-top:1px solid var(--stgwo-line);font-size:11px;line-height:1.7;color:var(--stgwo-faint)}
.stgw-onboarding-footer span{display:inline-flex;align-items:center;gap:7px}
.stgw-onboarding-footer span::before{content:"";width:4px;height:4px;border-radius:50%;background:color-mix(in srgb,var(--stgwo-faint) 60%,transparent)}
@keyframes stgwo-spin{to{transform:rotate(360deg)}}
@media(max-width:900px){
  .stgw-onboarding-shell{padding:24px 26px 28px;gap:36px}
  .stgw-onboarding-layout{grid-template-columns:minmax(0,1fr);gap:38px}
  .stgw-onboarding-main{padding-top:6px;max-width:none}
  .stgw-onboarding-aside{padding-top:0}
  .stgw-onboarding-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:0;gap:14px}
  .stgw-onboarding-steps li{flex-direction:column;gap:8px;padding:14px 0 0;border-top:1px solid var(--stgwo-line);border-bottom:0}
}
@media(max-width:620px){
  .stgw-onboarding-shell{padding:20px 18px 24px;gap:30px}
  .stgw-onboarding h1{font-size:27px;line-height:1.34}
  .stgw-onboarding-intro{margin-bottom:26px}
  .stgw-onboarding-card{padding:20px;border-radius:14px}
  .stgw-onboarding-steps{grid-template-columns:minmax(0,1fr);gap:0}
  .stgw-onboarding-steps li{flex-direction:row;padding:15px 0;border-bottom:1px solid var(--stgwo-line)}
  .stgw-onboarding-actions{flex-direction:column;align-items:stretch}
  .stgw-onboarding-primary,.stgw-onboarding-secondary{width:100%}
  .stgw-onboarding-primary[data-pending=true]{min-width:0}
}
@media(max-width:420px){
  .stgw-onboarding{font-size:13.5px}
  .stgw-onboarding-shell{padding:16px 14px 22px;gap:24px}
  .stgw-onboarding-top{gap:10px}
  .stgw-onboarding-back{padding:5px 9px;font-size:11.5px}
  .stgw-onboarding h1{font-size:24px;letter-spacing:-.03em;margin-bottom:14px}
  .stgw-onboarding-intro{font-size:12.5px;line-height:1.85;margin-bottom:22px}
  .stgw-onboarding-eyebrow{font-size:10px;letter-spacing:.13em;margin-bottom:12px}
  .stgw-onboarding-card{padding:16px;gap:16px}
  .stgw-onboarding-field input{padding:12px 13px;font-size:16px}
  .stgw-onboarding-footer{flex-direction:column;align-items:flex-start;gap:7px}
}
@media(prefers-reduced-motion:reduce){
  .stgw-onboarding *{transition:none!important;animation-duration:.001ms!important;animation-iteration-count:1!important}
}
@media(forced-colors:active){
  .stgw-onboarding-card,.stgw-onboarding-field input,.stgw-onboarding-aside-note{border-color:ButtonText}
  .stgw-onboarding-primary{border-color:ButtonText}
  .stgw-onboarding-spinner{border-color:ButtonText;border-top-color:transparent}
}

.stgw-onboarding-layout{grid-template-columns:minmax(0,640px);justify-content:center}.stgw-onboarding-main{max-width:640px}.stgw-onboarding-shell{max-width:960px}.stgw-onboarding h1{font-size:28px;line-height:1.45}
`;
