"use client";

// Styles for the chat-style Messages pages. Injected as a <style> tag so it works
// regardless of how your global CSS / bundler is set up.
const css = `
/* ===== Chat-style messages (append to your global stylesheet) ===== */
.chat{
  --c-line:color-mix(in srgb,currentColor 12%,transparent);
  --c-soft:color-mix(in srgb,currentColor 6%,transparent);
  --c-acc:var(--accent,#f5b400);          /* <- change to your honey/amber variable */
  display:grid;grid-template-columns:320px 1fr;grid-template-rows:minmax(0,1fr);
  height:min(74vh,700px);min-height:480px;margin-top:18px;
  border:1px solid var(--c-line);border-radius:20px;overflow:hidden;
}
/* left pane */
.chat .chat-side{min-height:0;display:flex;flex-direction:column;padding:20px 14px;border-right:1px solid var(--c-line);overflow-y:auto;min-width:0}
.chat .chat-side h2{margin:0 6px 14px;font-size:20px;font-weight:600}
.chat .chat-search{display:flex;align-items:center;gap:8px;padding:9px 14px;margin:0 4px 12px;border:1px solid var(--c-line);border-radius:999px}
.chat .chat-search .i{width:16px;height:16px;opacity:.6;flex:none}
.chat .chat-search input{flex:1;min-width:0;background:none;border:0;outline:0;color:inherit;font:inherit;font-size:13.5px;padding:0}
.chat .chat-sec{display:flex;align-items:center;gap:8px;margin:14px 8px 6px;font-size:13px;font-weight:600;opacity:.8}
.chat .chat-sec .i{width:16px;height:16px}
.chat .crow{display:flex;gap:11px;align-items:center;width:100%;padding:10px 8px;border:0;border-radius:14px;background:none;color:inherit;text-align:left;cursor:pointer;font:inherit}
.chat .crow:hover{background:var(--c-soft)}
.chat .crow.on{background:color-mix(in srgb,var(--c-acc) 14%,transparent)}
.chat .cav{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;
  background:color-mix(in srgb,var(--c-acc) 22%,transparent);color:var(--c-acc)}
.chat .cav.sm{width:30px;height:30px;font-size:10.5px}
.chat .cav.lg{width:46px;height:46px;font-size:14px}
.chat .cmid{flex:1;min-width:0}
.chat .cmid b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chat .cmid span{display:block;font-size:12.5px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chat .cend{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:11px;opacity:.9}
.chat .cend time{opacity:.6}
.chat .cbadge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e5484d;color:#fff;font-size:10.5px;font-weight:700;display:grid;place-items:center}
.chat .ctick{font-size:12px;letter-spacing:-2px;opacity:.5}
.chat .ctick.read{color:#30a46c;opacity:1}
/* right pane */
.chat .chat-main{display:flex;flex-direction:column;min-width:0;min-height:0}
.chat .chat-head{display:flex;align-items:center;gap:12px;padding:16px 22px;border-bottom:1px solid var(--c-line)}
.chat .chat-head b{display:block;font-size:17px;font-weight:600}
.chat .chat-head small{font-size:12.5px;opacity:.65}
.chat .chat-head .ib{display:none}
.chat .chat-body{flex:1;min-height:0;overflow-y:auto;padding:22px;display:flex;flex-direction:column;gap:16px}
.chat .chat-empty{margin:auto;text-align:center;opacity:.55;font-size:14px}
.chat .cday{display:flex;align-items:center;gap:14px;font-size:12px;opacity:.6}
.chat .cday::before,.chat .cday::after{content:"";flex:1;height:1px;background:var(--c-line)}
.chat .cmsg{display:flex;gap:10px;align-items:flex-end;max-width:min(78%,560px)}
.chat .cmsg.out{align-self:flex-end;flex-direction:row-reverse}
.chat .cwrap{min-width:0}
.chat .cmeta{font-size:12px;margin:0 2px 4px;opacity:.65}
.chat .cmsg.out .cmeta{text-align:right}
.chat .cbub{padding:11px 15px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--c-soft);border-bottom-left-radius:5px}
.chat .cmsg.out .cbub{background:color-mix(in srgb,var(--c-acc) 18%,transparent);border-bottom-left-radius:16px;border-bottom-right-radius:5px}
.chat .cbub b{display:block;margin-bottom:3px}
.chat .cfoot{margin:3px 4px 0;text-align:right}
/* composer */
.chat .chat-form{display:flex;gap:10px;align-items:flex-end;padding:14px 18px;border-top:1px solid var(--c-line)}
.chat .chat-form textarea{flex:1;resize:none;max-height:120px;padding:11px 16px;border:1px solid var(--c-line);border-radius:22px;background:none;color:inherit;font:inherit;font-size:14px;outline:0}
.chat .chat-form textarea:focus{border-color:var(--c-acc)}
.chat .chat-send{flex:none;width:44px;height:44px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;background:var(--c-acc);color:#1a1300}
.chat .chat-send:disabled{opacity:.5;cursor:default}
.chat .chat-send .i{width:18px;height:18px}
.chat .chat-err{margin:0;padding:8px 22px;font-size:13px;color:#e5484d}
.chat .cav{overflow:hidden}
.chat .cav img{width:100%;height:100%;object-fit:cover;display:block}
/* mobile: show one pane at a time */
@media (max-width:760px){
  .chat{grid-template-columns:1fr}
  .chat.has-sel .chat-side{display:none}
  .chat:not(.has-sel) .chat-main{display:none}
  .chat .chat-head .ib{display:grid}
  .chat .cmsg{max-width:88%}
}

`;

export function ChatStyles() {
  return <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />;
}