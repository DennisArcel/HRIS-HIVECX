// Shared styles for the document cards and checklist. Render <DocStyles /> once per page.
export function DocStyles() {
  return (
    <style suppressHydrationWarning>{`
@keyframes dc-pop { from { opacity: 0; transform: scale(.9) translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes dc-fill { from { width: 0; } }

.dc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; padding: 6px; }

.dc-card {
  display: flex; flex-direction: column; overflow: hidden; border-radius: 16px;
  background: var(--card, var(--bg)); border: 1px solid var(--bd, #2a2a2a);
  animation: dc-pop .5s cubic-bezier(.2, .9, .3, 1.2) both;
  transition: transform .28s cubic-bezier(.2, .9, .3, 1.35), box-shadow .28s, border-color .28s;
}
.dc-card:hover { transform: translateY(-6px) scale(1.04); box-shadow: 0 18px 40px rgba(0, 0, 0, .45); border-color: var(--ac, #f5b800); position: relative; z-index: 2; }

.dc-prev { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: #1a1a1a; }
.dc-prev img, .dc-prev iframe { display: block; width: 100%; height: 100%; border: 0; object-fit: cover; background: #fff; pointer-events: none; transition: transform .45s ease; }
.dc-card:hover .dc-prev img, .dc-card:hover .dc-prev iframe { transform: scale(1.07); }
.dc-prev-tag { position: absolute; left: 10px; top: 10px; font-size: 11px; padding: 3px 9px; border-radius: 999px; background: rgba(0, 0, 0, .65); color: #fff; backdrop-filter: blur(4px); }
.dc-empty { height: 100%; display: grid; place-items: center; text-align: center; gap: 6px; align-content: center; color: var(--mut, #888); font-size: 13px; }
.dc-avatar { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 24px; font-weight: 700; background: var(--ac, #f5b800); color: #111; margin: 0 auto; transition: transform .3s cubic-bezier(.2, .9, .3, 1.5); }
.dc-card:hover .dc-avatar { transform: scale(1.15) rotate(-4deg); }

.dc-body { padding: 14px 16px 16px; display: grid; gap: 10px; }
.dc-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dc-bar { height: 6px; border-radius: 999px; background: var(--bd, #2a2a2a); overflow: hidden; }
.dc-bar > i { display: block; height: 100%; border-radius: 999px; background: var(--ac, #f5b800); animation: dc-fill .8s ease both; }
.dc-bar.done > i { background: var(--ok, #3ecf8e); }
.dc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dc-btn {
  display: block; text-align: center; text-decoration: none; cursor: pointer; font-size: 14px; padding: 9px 16px; border-radius: 999px;
  border: 1px solid var(--bd, #333); color: var(--tx); background: transparent; transition: background .2s, color .2s, transform .2s, border-color .2s;
}
.dc-btn:hover { background: var(--ac, #f5b800); color: #111; border-color: var(--ac, #f5b800); transform: scale(1.04); }
.dc-btn[disabled] { opacity: .6; cursor: default; transform: none; }

/* Checklist rows on the employee and per-employee pages */
.dc-row {
  display: grid; gap: 10px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--bd, #2a2a2a);
  background: var(--card, var(--bg)); animation: dc-pop .45s cubic-bezier(.2, .9, .3, 1.2) both;
  transition: transform .25s cubic-bezier(.2, .9, .3, 1.35), box-shadow .25s, border-color .25s;
}
.dc-row:hover { transform: scale(1.015); box-shadow: 0 10px 26px rgba(0, 0, 0, .35); border-color: var(--ac, #f5b800); }
.dc-row.ok { border-color: color-mix(in srgb, var(--ok, #3ecf8e) 45%, transparent); }
.dc-row-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.dc-file { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; padding-top: 8px; border-top: 1px dashed var(--bd, #2a2a2a); }
.dc-mini { border: 1px solid var(--bd, #333); color: var(--tx); background: transparent; padding: 6px 14px; border-radius: 999px; font-size: 13px; cursor: pointer; transition: transform .2s, background .2s, color .2s; }
.dc-mini:hover { transform: scale(1.08); background: var(--ac, #f5b800); color: #111; }
.dc-mini[disabled] { opacity: .5; cursor: default; transform: none; }

/* Profile picture uploader */
.dc-ava-wrap { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.dc-ava { width: 96px; height: 96px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; font-size: 36px; font-weight: 700; background: var(--ac, #f5b800); color: #111; border: 3px solid var(--bd, #2a2a2a); transition: transform .3s cubic-bezier(.2, .9, .3, 1.5), border-color .3s; animation: dc-pop .5s cubic-bezier(.2, .9, .3, 1.2) both; }
.dc-ava img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dc-ava:hover { transform: scale(1.1); border-color: var(--ac, #f5b800); }

/* Document cards (per-employee and employee pages) */
.dc-doc-meta { font-size: 12.5px; color: var(--mut, #888); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dc-prev.click { cursor: pointer; }
.dc-prev.sq { aspect-ratio: 1 / 1; }
.dc-photo img { object-position: center 20%; }
.dc-ext { font-size: 22px; font-weight: 700; letter-spacing: .06em; padding: 10px 16px; border-radius: 12px; border: 1px dashed var(--bd, #444); }
.dc-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dc-add { display: grid; align-content: center; justify-items: center; gap: 12px; min-height: 260px; padding: 20px; text-align: center; border-radius: 16px; border: 2px dashed var(--bd, #333); animation: dc-pop .5s cubic-bezier(.2, .9, .3, 1.2) both; transition: transform .28s cubic-bezier(.2, .9, .3, 1.35), border-color .28s; }
.dc-add:hover { transform: scale(1.04); border-color: var(--ac, #f5b800); }
.dc-add select { background: var(--bg); color: var(--tx); border: 1px solid var(--bd, #333); border-radius: 10px; padding: 9px 12px; font: inherit; max-width: 100%; }
.dc-plus { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; font-size: 30px; background: var(--ac, #f5b800); color: #111; transition: transform .3s cubic-bezier(.2, .9, .3, 1.5); }
.dc-add:hover .dc-plus { transform: rotate(90deg) scale(1.12); }
.dc-chip { cursor: pointer; font: inherit; transition: transform .2s; }
.dc-chip:hover { transform: scale(1.08); }

@media (prefers-reduced-motion: reduce) {
  .dc-card, .dc-row, .dc-add, .dc-bar > i { animation: none; }
  .dc-card:hover, .dc-row:hover, .dc-btn:hover, .dc-mini:hover { transform: none; }
}
    `}</style>
  );
}