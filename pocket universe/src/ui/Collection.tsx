import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BIOMES } from "../data/biomes";
import { SIZE_LABEL } from "../data/terrain";
import type { World } from "../data/types";
import { useStore } from "../state/store";
import { Confirm, exportWorlds, Modal, pickAndImport, relTime, slug } from "./common";
import { Icon } from "./icons";

function Card({ w, i, onRename, onDelete }: { w: World; i: number; onRename: () => void; onDelete: () => void }) {
  const open = useStore((s) => s.openWorld), dup = useStore((s) => s.duplicateWorld), toast = useStore((s) => s.toast);
  const [menu, setMenu] = useState(false);
  const B = BIOMES[w.biome];
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);
  return (
    <motion.article className="world-card" layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ delay: Math.min(i, 8) * 0.05, type: "spring", stiffness: 260, damping: 28 }}>
      <button className="wc-thumb" onClick={() => open(w.id)} aria-label={`Continue building ${w.name}`} style={{ background: `radial-gradient(120% 90% at 30% 20%, ${B.ui[0]}66, transparent 60%), linear-gradient(160deg, #242044, #111329)` }}>
        {w.thumb ? <img src={w.thumb} alt="" draggable={false} /> : <span className="wc-placeholder"><Icon n="globe" s={34} w={1.2} /></span>}
        <span className="wc-play"><Icon n="sparkle" s={14} /> Continue</span>
      </button>
      <div className="wc-body">
        <div className="wc-title">
          <h3 title={w.name}>{w.name}</h3>
          <div className="menu-wrap" onPointerDown={(e) => e.stopPropagation()}>
            <button className="icon-btn ghost small" aria-label={`More options for ${w.name}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon n="dots" /></button>
            <AnimatePresence>
              {menu && (
                <motion.div className="menu" initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }}>
                  <button onClick={() => { setMenu(false); onRename(); }}><Icon n="edit" s={16} /> Rename</button>
                  <button onClick={async () => { setMenu(false); const c = await dup(w.id); if (c) toast("Duplicated", `${c.name} is ready to explore.`); }}><Icon n="copy" s={16} /> Duplicate</button>
                  <button onClick={() => { setMenu(false); exportWorlds([w], slug(w.name) + ".pocket.json"); }}><Icon n="download" s={16} /> Export</button>
                  <button className="danger" onClick={() => { setMenu(false); onDelete(); }}><Icon n="trash" s={16} /> Delete</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="wc-meta"><span className="chip" style={{ ["--c" as any]: B.ui[0] }}>{B.name}</span><span>{SIZE_LABEL[w.size]} · {w.objects.length} things</span></p>
        <div className="wc-foot">
          <span className="muted small">Edited {relTime(w.updatedAt)}</span>
          <button className="btn small primary" onClick={() => open(w.id)}>Continue building</button>
        </div>
      </div>
    </motion.article>
  );
}

export function Collection() {
  const worlds = useStore((s) => s.worlds), loaded = useStore((s) => s.loaded), go = useStore((s) => s.go);
  const startCreate = useStore((s) => s.startCreate), surprise = useStore((s) => s.surprise), rename = useStore((s) => s.renameWorld), del = useStore((s) => s.deleteWorld), toast = useStore((s) => s.toast);
  const [renaming, setRenaming] = useState<World | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<World | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="screen collection">
      <header className="col-head">
        <button className="icon-btn glassy" onClick={() => go("welcome")} aria-label="Back to the welcome screen"><Icon n="back" /></button>
        <div>
          <p className="eyebrow">Your collection</p>
          <h1>My Universes</h1>
        </div>
        <div className="col-actions">
          <button className="btn glassy" onClick={pickAndImport}><Icon n="upload" s={16} /> Import</button>
          {worlds.length > 0 && <button className="btn glassy" onClick={() => exportWorlds(worlds, "pocket-universe-collection.json")}><Icon n="download" s={16} /> Export all</button>}
          <button className="btn glassy" disabled={busy} onClick={async () => { setBusy(true); await surprise(); setBusy(false); }}><Icon n="dice" s={16} /> Surprise me</button>
          <button className="btn primary" onClick={startCreate}><Icon n="plus" s={16} /> Create a Universe</button>
        </div>
      </header>
      {loaded && worlds.length === 0 ? (
        <motion.div className="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2>No worlds yet</h2>
          <p className="muted">Every universe starts as a little island in the dark. Make your first one.</p>
          <div className="row gap center">
            <button className="btn primary big" onClick={startCreate}><Icon n="sparkle" /> Create a Universe</button>
            <button className="btn glassy big" onClick={() => surprise()}><Icon n="dice" /> Surprise me</button>
          </div>
        </motion.div>
      ) : (
        <div className="grid">
          <AnimatePresence>
            {worlds.map((w, i) => (
              <Card key={w.id} w={w} i={i} onRename={() => { setRenaming(w); setName(w.name); }} onDelete={() => setDeleting(w)} />
            ))}
          </AnimatePresence>
        </div>
      )}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename world">
        <form onSubmit={(e) => { e.preventDefault(); if (renaming && name.trim()) { rename(renaming.id, name); setRenaming(null); } }}>
          <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="World name" />
          <div className="row end gap"><button type="button" className="btn ghost" onClick={() => setRenaming(null)}>Cancel</button><button className="btn primary" disabled={!name.trim()}>Save name</button></div>
        </form>
      </Modal>
      <Confirm open={!!deleting} title={`Delete ${deleting?.name ?? ""}?`} text="This world and everything in it will be gone from this browser. This can't be undone." yes="Delete world"
        onNo={() => setDeleting(null)} onYes={async () => { if (deleting) { await del(deleting.id); toast("Deleted", `${deleting.name} drifted away.`); } setDeleting(null); }} />
    </div>
  );
}
