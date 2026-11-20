import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { isWorld } from "../data/db";
import type { World } from "../data/types";
import { useStore } from "../state/store";
import { Icon } from "./icons";

export function relTime(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** saves a file: through the Claude artifact viewer when hosted there, otherwise a normal browser download */
export async function saveFile(name: string, data: Blob): Promise<boolean> {
  const c = (window as any).claude;
  if (c && typeof c.use === "function") {
    try {
      const d = await c.use("downloads");
      if (d) { await d.save({ filename: name, data }); return true; }
    } catch (e: any) { if (e && e.code === "declined") return false; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(data); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
export function downloadText(name: string, text: string) { return saveFile(name, new Blob([text], { type: "application/json" })); }
export async function downloadDataUrl(name: string, url: string) { const b = await (await fetch(url)).blob(); return saveFile(name, b); }
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "world";

export function exportWorlds(ws: World[], name: string) {
  const clean = ws.map(({ thumb, ...w }) => w);
  downloadText(name, JSON.stringify({ app: "pocket-universe", version: 1, exported: new Date().toISOString(), worlds: clean }, null, 0));
}

/** opens a file picker and imports any worlds found in the chosen JSON files */
export function pickAndImport() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json"; input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files ?? []);
    const found: World[] = [];
    for (const f of files) {
      try {
        const data = JSON.parse(await f.text());
        const list = Array.isArray(data) ? data : Array.isArray(data.worlds) ? data.worlds : [data];
        for (const w of list) if (isWorld(w)) found.push(w);
      } catch { /* not JSON */ }
    }
    const st = useStore.getState();
    if (!found.length) { st.toast("Nothing to import", "That file doesn't contain any Pocket Universe worlds."); return; }
    const n = await st.importWorlds(found);
    st.toast("Imported", `${n} world${n > 1 ? "s" : ""} added to your collection.`);
  };
  input.click();
}

export function Modal({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    const f = ref.current?.querySelector<HTMLElement>("input,button");
    f?.focus();
    return () => window.removeEventListener("keydown", k, true);
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={"modal" + (wide ? " wide" : "")}
            initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
            {title && <div className="modal-head"><h2>{title}</h2><button className="icon-btn ghost" onClick={onClose} aria-label="Close"><Icon n="x" /></button></div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts), dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button key={t.id} className="toast" onClick={() => dismiss(t.id)} layout
            initial={{ opacity: 0, y: -14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
            <span className="toast-star"><Icon n="sparkle" s={16} /></span>
            <span><b>{t.title}</b><small>{t.text}</small></span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Confirm({ open, title, text, yes, onYes, onNo }: { open: boolean; title: string; text: string; yes: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal open={open} onClose={onNo} title={title}>
      <p className="muted">{text}</p>
      <div className="row end gap">
        <button className="btn ghost" onClick={onNo}>Keep it</button>
        <button className="btn danger" onClick={onYes}>{yes}</button>
      </div>
    </Modal>
  );
}
