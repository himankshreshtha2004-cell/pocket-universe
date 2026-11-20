import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BIOMES, SKY_TINTS, TIME_LABEL, TIMES, WEATHER_LABEL } from "../data/biomes";
import { CATEGORIES, ITEMS, SURFACE_LABEL, TERRAIN_TOOLS, type CategoryId } from "../data/catalog";
import { SIZE_LABEL } from "../data/terrain";
import { SURFACES, type ObjectKind, type TimeOfDay } from "../data/types";
import { captureRef, useStore, type Brush } from "../state/store";
import { Model } from "../three/assets";
import { thumb } from "../three/Thumbs";
import { Confirm, downloadDataUrl, exportWorlds, Modal, pickAndImport, slug } from "./common";
import { Icon } from "./icons";

const TIME_ICON = { morning: "sunrise", afternoon: "sun", sunset: "sunset", night: "moon" } as const;
type Tab = CategoryId | "terrain";
const TAB_ICON: Record<Tab, string> = { nature: "leaf", landscape: "mountain", structures: "house", magic: "wand", terrain: "brush" };

function ItemThumb({ kind }: { kind: ObjectKind }) {
  const biome = useStore((s) => s.current?.biome ?? "forest");
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setUrl(null);
    thumb(`item-${biome}-${kind}`, <Model kind={kind} biome={BIOMES[biome]} v={7} />, { w: 112, h: 112, dir: [1, 0.7, 1.3], pad: 0.86 }).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [biome, kind]);
  return url ? <img src={url} alt="" draggable={false} /> : <span className="shimmer" />;
}

function Dock() {
  const [tab, setTab] = useState<Tab | null>("nature");
  const mode = useStore((s) => s.mode), placeKind = useStore((s) => s.placeKind), choose = useStore((s) => s.choosePlace), setMode = useStore((s) => s.setMode);
  const tool = useStore((s) => s.terrainTool), setTool = useStore((s) => s.setTerrainTool), surface = useStore((s) => s.surface), setSurface = useStore((s) => s.setSurface);
  const brush = useStore((s) => s.brush), setBrush = useStore((s) => s.setBrush), biome = useStore((s) => s.current?.biome ?? "forest");
  const cat = CATEGORIES.find((c) => c.id === tab);
  const pal = BIOMES[biome].palette.surface;
  return (
    <div className="dock-wrap">
      <AnimatePresence mode="wait">
        {tab && (
          <motion.div key={tab} className="tray" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
            {cat && cat.items.map((it) => (
              <button key={it.kind} className={"item" + (placeKind === it.kind ? " on" : "")} onClick={() => choose(placeKind === it.kind ? null : it.kind)} aria-pressed={placeKind === it.kind} aria-label={`Place ${it.label}`} title={`Place ${it.label}`}>
                <span className="item-art"><ItemThumb kind={it.kind} /></span>
                <span className="item-label">{it.label}</span>
              </button>
            ))}
            {tab === "terrain" && (
              <div className="terrain-tray">
                <div className="tt-group">
                  {TERRAIN_TOOLS.filter((t) => t.id !== "paint").map((t) => (
                    <button key={t.id} className={"tool" + (mode === "terrain" && tool === t.id ? " on" : "")} onClick={() => setTool(t.id)} title={t.hint} aria-label={t.label} aria-pressed={mode === "terrain" && tool === t.id}><Icon n={t.id} s={18} /><span>{t.label}</span></button>
                  ))}
                </div>
                <div className="tt-group surfaces" role="group" aria-label="Paint the ground">
                  {SURFACES.map((s) => (
                    <button key={s} className={"surf" + (mode === "terrain" && tool === "paint" && surface === s ? " on" : "")} onClick={() => setSurface(s)} title={`Paint ${SURFACE_LABEL[s]}`} aria-label={`Paint ${SURFACE_LABEL[s]}`} aria-pressed={mode === "terrain" && tool === "paint" && surface === s}>
                      <span className="surf-dot" style={{ background: pal[s] }} /><span>{SURFACE_LABEL[s]}</span>
                    </button>
                  ))}
                </div>
                <div className="tt-group brush" role="group" aria-label="Brush size">
                  {(["S", "M", "L"] as Brush[]).map((b) => <button key={b} className={brush === b ? "on" : ""} onClick={() => setBrush(b)} aria-label={`Brush ${b}`}><span style={{ width: b === "S" ? 8 : b === "M" ? 13 : 19, height: b === "S" ? 8 : b === "M" ? 13 : 19 }} /></button>)}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <nav className="dock" aria-label="Build toolbar">
        <button className={"dock-btn" + (mode === "explore" ? " on" : "")} onClick={() => { setMode("explore"); }} title="Explore and select (Esc)" aria-label="Explore"><Icon n="hand" s={19} /><span>Explore</span></button>
        <span className="dock-sep" />
        {(["nature", "landscape", "structures", "magic", "terrain"] as Tab[]).map((t) => (
          <button key={t} className={"dock-btn" + (tab === t ? " open" : "")} onClick={() => { setTab(tab === t ? null : t); if (t === "terrain" && tab !== t) setTool(tool); }} aria-expanded={tab === t} aria-label={t === "terrain" ? "Terrain" : CATEGORIES.find((c) => c.id === t)!.label} title={t === "terrain" ? "Terrain" : CATEGORIES.find((c) => c.id === t)!.label}>
            <Icon n={TAB_ICON[t]} s={19} /><span>{t === "terrain" ? "Terrain" : CATEGORIES.find((c) => c.id === t)!.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Hint() {
  const mode = useStore((s) => s.mode), placeKind = useStore((s) => s.placeKind), tool = useStore((s) => s.terrainTool), selected = useStore((s) => s.selectedId);
  let text = "Drag to look around · scroll to zoom · click anything to select it";
  if (mode === "place" && placeKind) text = `Click your world to place ${ITEMS[placeKind].label.toLowerCase()} · R rotates · Esc to stop`;
  else if (mode === "terrain") text = TERRAIN_TOOLS.find((t) => t.id === tool)!.hint + " · drag off the island to look around";
  else if (selected) text = "Drag it to move · R rotates · Delete removes · Esc deselects";
  return <motion.p key={text} className="hint" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>{text}</motion.p>;
}

function SelectionPanel() {
  const id = useStore((s) => s.selectedId), world = useStore((s) => s.current);
  const commit = useStore((s) => s.commit), begin = useStore((s) => s.begin), live = useStore((s) => s.live), end = useStore((s) => s.end);
  const remove = useStore((s) => s.removeSelected), dup = useStore((s) => s.duplicateSelected), select = useStore((s) => s.select);
  const o = id && world ? world.objects.find((x) => x.id === id) : null;
  const rot = (d: number) => commit((w) => ({ ...w, objects: w.objects.map((x) => (x.id === id ? { ...x, r: x.r + d } : x)) }));
  return (
    <AnimatePresence>
      {o && (
        <motion.aside className="sel-panel" initial={{ opacity: 0, x: 20, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 16, scale: 0.97 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
          <div className="sp-head">
            <span className="sp-art"><ItemThumb kind={o.kind} /></span>
            <div><p className="eyebrow">Selected</p><h3>{ITEMS[o.kind].label}</h3></div>
            <button className="icon-btn ghost small" onClick={() => select(null)} aria-label="Deselect"><Icon n="x" s={16} /></button>
          </div>
          <div className="sp-row">
            <span className="sp-label">Rotate</span>
            <div className="row gap-s">
              <button className="icon-btn glassy" onClick={() => rot(-Math.PI / 8)} aria-label="Rotate left"><Icon n="rotl" s={17} /></button>
              <button className="icon-btn glassy" onClick={() => rot(Math.PI / 8)} aria-label="Rotate right"><Icon n="rotr" s={17} /></button>
            </div>
          </div>
          <div className="sp-row col">
            <span className="sp-label">Size <span className="muted">{Math.round(o.s * 100)}%</span></span>
            <input type="range" min={ITEMS[o.kind].scale[0]} max={ITEMS[o.kind].scale[1]} step={0.02} value={o.s} aria-label="Size"
              onPointerDown={begin} onKeyDown={begin} onPointerUp={end} onKeyUp={end} onBlur={end}
              onChange={(e) => { const v = +e.target.value; live((w) => ({ ...w, objects: w.objects.map((x) => (x.id === id ? { ...x, s: v } : x)) })); }} />
          </div>
          {(ITEMS[o.kind].lift ?? 0) > 0 && (
            <div className="sp-row col">
              <span className="sp-label">Height</span>
              <input type="range" min={0.3} max={3.5} step={0.05} value={o.p[1]} aria-label="Float height"
                onPointerDown={begin} onKeyDown={begin} onPointerUp={end} onKeyUp={end} onBlur={end}
                onChange={(e) => { const v = +e.target.value; live((w) => ({ ...w, objects: w.objects.map((x) => (x.id === id ? { ...x, p: [x.p[0], v, x.p[2]] } : x)) })); }} />
            </div>
          )}
          <div className="sp-actions">
            <button className="btn glassy small" onClick={dup}><Icon n="copy" s={15} /> Duplicate</button>
            <button className="btn danger small" onClick={remove}><Icon n="trash" s={15} /> Remove</button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function SaveBadge() {
  const save = useStore((s) => s.save);
  return (
    <span className={"save " + save} role="status">
      {save === "saved" ? <><Icon n="check" s={14} w={2.4} /> All changes saved</> : <><span className="spin" /> Saving…</>}
    </span>
  );
}

function TimeMenu() {
  const time = useStore((s) => s.current?.env.time ?? "afternoon"), setEnv = useStore((s) => s.setEnv);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const c = () => setOpen(false); window.addEventListener("pointerdown", c); return () => window.removeEventListener("pointerdown", c); }, [open]);
  return (
    <div className="menu-wrap" onPointerDown={(e) => e.stopPropagation()}>
      <button className="icon-btn glassy" onClick={() => setOpen((o) => !o)} aria-label={`Time of day: ${TIME_LABEL[time]}`} title="Time of day" aria-expanded={open}><Icon n={TIME_ICON[time]} /></button>
      <AnimatePresence>
        {open && (
          <motion.div className="menu right" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            {TIMES.map((t) => <button key={t} className={t === time ? "on" : ""} onClick={() => { setEnv({ time: t as TimeOfDay }); setOpen(false); }}><Icon n={TIME_ICON[t]} s={16} /> {TIME_LABEL[t]}</button>)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Settings() {
  const open = useStore((s) => s.settingsOpen), world = useStore((s) => s.current);
  const setEnv = useStore((s) => s.setEnv), rename = useStore((s) => s.renameCurrent), exit = useStore((s) => s.exitWorld), del = useStore((s) => s.deleteWorld);
  const reduced = useStore((s) => s.reducedMotion), quality = useStore((s) => s.quality), setPrefs = useStore((s) => s.setPrefs), go = useStore((s) => s.go);
  const [name, setName] = useState(world?.name ?? "");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (open && world) setName(world.name); }, [open]);
  if (!world) return null;
  const B = BIOMES[world.biome], env = world.env;
  const close = () => useStore.setState({ settingsOpen: false });
  return (
    <>
      <Modal open={open} onClose={close} title="World settings" wide>
        <div className="settings">
          <section>
            <h4>Environment</h4>
            <label className="lbl">Time of day</label>
            <div className="seg four">{TIMES.map((t) => <button key={t} className={env.time === t ? "on" : ""} onClick={() => setEnv({ time: t })}><Icon n={TIME_ICON[t]} s={16} />{TIME_LABEL[t]}</button>)}</div>
            <label className="lbl">Weather</label>
            <div className="seg">{B.weathers.map((w) => <button key={w} className={env.weather === w ? "on" : ""} onClick={() => setEnv({ weather: w })}><Icon n={w} s={16} />{WEATHER_LABEL[w]}</button>)}</div>
            <label className="lbl">Sky colour</label>
            <div className="swatches">
              {SKY_TINTS.map((c) => <button key={c || "none"} className={"swatch" + (env.sky === c ? " on" : "")} style={{ background: c || "conic-gradient(#5f95e6, #f6a98a, #8177c9, #5f95e6)" }} onClick={() => setEnv({ sky: c })} aria-label={c ? `Sky tint ${c}` : "Natural sky"} />)}
              <label className="swatch custom" style={{ background: env.sky && !SKY_TINTS.includes(env.sky) ? env.sky : undefined }}><Icon n="plus" s={14} /><input type="color" value={env.sky || "#a9c9f5"} onChange={(e) => setEnv({ sky: e.target.value })} aria-label="Custom sky colour" /></label>
            </div>
            <label className="lbl">Ambient light <span className="muted">{Math.round(env.ambient * 100)}%</span></label>
            <input type="range" min={0.5} max={1.5} step={0.05} value={env.ambient} onChange={(e) => setEnv({ ambient: +e.target.value })} aria-label="Ambient light" />
          </section>
          <section>
            <h4>World</h4>
            <label className="lbl">Name</label>
            <form className="row gap-s" onSubmit={(e) => { e.preventDefault(); rename(name); }}>
              <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="World name" />
              <button className="btn glassy" disabled={!name.trim() || name.trim() === world.name}>Rename</button>
            </form>
            <p className="muted small">{B.name} · {SIZE_LABEL[world.size]} · seed {world.seed} · {world.objects.length} things</p>
            <h4>Your data</h4>
            <div className="row gap-s wrap">
              <button className="btn glassy small" onClick={() => exportWorlds([world], slug(world.name) + ".pocket.json")}><Icon n="download" s={15} /> Export world</button>
              <button className="btn glassy small" onClick={pickAndImport}><Icon n="upload" s={15} /> Import worlds</button>
            </div>
            <p className="muted small">Worlds are saved automatically in this browser. Export to keep a copy or move a world to another device.</p>
            <h4>Comfort</h4>
            <label className="toggle"><input type="checkbox" checked={reduced} onChange={(e) => setPrefs({ reducedMotion: e.target.checked })} /><span />Reduce motion</label>
            <label className="toggle"><input type="checkbox" checked={quality === "high"} onChange={(e) => setPrefs({ quality: e.target.checked ? "high" : "low" })} /><span />Best graphics (glow, depth, soft shadows)</label>
          </section>
        </div>
        <div className="settings-foot">
          <button className="btn ghost danger-text" onClick={() => setConfirm(true)}><Icon n="trash" s={15} /> Delete world</button>
          <div className="row gap-s">
            <button className="btn glassy" onClick={() => { close(); useStore.setState((s) => ({ resetCam: s.resetCam + 1 })); }}><Icon n="home" s={15} /> Reset camera</button>
            <button className="btn primary" onClick={() => { close(); exit(); }}><Icon n="globe" s={15} /> Back to My Universes</button>
          </div>
        </div>
      </Modal>
      <Confirm open={confirm} title={`Delete ${world.name}?`} text="This world and everything in it will be removed from this browser. This can't be undone." yes="Delete world"
        onNo={() => setConfirm(false)} onYes={async () => { setConfirm(false); close(); const id = world.id; useStore.setState({ current: null }); await del(id); go("collection"); }} />
    </>
  );
}

function Cinematic() {
  const on = useStore((s) => s.cinematic), world = useStore((s) => s.current), discover = useStore((s) => s.discover);
  const [flash, setFlash] = useState(false);
  const shoot = async () => {
    const url = captureRef.fn?.(0, 0, "image/png");
    if (!url || !world) return;
    setFlash(true); window.setTimeout(() => setFlash(false), 450);
    const saved = await downloadDataUrl(`${slug(world.name)}-${new Date().toISOString().slice(0, 10)}.png`, url);
    if (saved) discover("first-photo", "A memory, captured", "Your screenshot is saved to your downloads.");
  };
  return (
    <AnimatePresence>
      {on && (
        <motion.div className="cinematic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
          <motion.div className="bar top" initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} />
          <motion.div className="bar bot" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} />
          <div className="cine-title"><p className="eyebrow">Pocket Universe</p><h2>{world?.name}</h2></div>
          <div className="cine-controls">
            <button className="btn glassy" onClick={shoot}><Icon n="camera" s={16} /> Capture</button>
            <button className="btn glassy" onClick={() => useStore.setState({ cinematic: false })}><Icon n="x" s={16} /> Exit</button>
          </div>
          <p className="cine-hint">Drag to orbit · Esc to return</p>
          {flash && <div className="flash" />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WelcomeBanner() {
  const introAt = useStore((s) => s.introAt), name = useStore((s) => s.welcomeName);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!introAt) return;
    const a = window.setTimeout(() => setShow(true), Math.max(0, introAt - performance.now()) + 500);
    const b = window.setTimeout(() => setShow(false), Math.max(0, introAt - performance.now()) + 3300);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [introAt]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="welcome-banner" initial={{ opacity: 0, y: 10, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(8px)" }} transition={{ duration: 0.9 }}>
          <p className="eyebrow">Welcome to</p>
          <h1>{name}</h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Builder() {
  const world = useStore((s) => s.current), exit = useStore((s) => s.exitWorld), undo = useStore((s) => s.undo), redo = useStore((s) => s.redo);
  const past = useStore((s) => s.past.length), future = useStore((s) => s.future.length), cinematic = useStore((s) => s.cinematic), rename = useStore((s) => s.renameCurrent);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  // keyboard shortcuts
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || s.settingsOpen) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); s.redo(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); s.saveNow(true); return; }
      if (mod && e.key.toLowerCase() === "d" && s.selectedId) { e.preventDefault(); s.duplicateSelected(); return; }
      if (e.key === "Escape") {
        if (s.cinematic) useStore.setState({ cinematic: false });
        else if (s.mode !== "explore") s.setMode("explore");
        else s.select(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && s.selectedId) { e.preventDefault(); s.removeSelected(); return; }
      if (e.key.toLowerCase() === "r" && !mod) {
        const d = (e.shiftKey ? -1 : 1) * Math.PI / 8;
        if (s.mode === "place") s.rotateGhost(d);
        else if (s.selectedId) s.commit((w) => ({ ...w, objects: w.objects.map((x) => (x.id === s.selectedId ? { ...x, r: x.r + d } : x)) }));
      }
      if (e.key.toLowerCase() === "c" && !mod && !s.cinematic) useStore.setState({ cinematic: true, selectedId: null });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  if (!world) return null;
  const B = BIOMES[world.biome];

  return (
    <div className={"screen builder" + (cinematic ? " hidden-ui" : "")}>
      <WelcomeBanner />
      <AnimatePresence>
      {!cinematic && <motion.header className="hud-top" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ delay: 0.25 }}>
        <div className="hud-left">
          <button className="btn glassy" onClick={exit}><Icon n="back" s={16} /> My Universes</button>
          <div className="world-name">
            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); rename(inputRef.current?.value ?? ""); setEditing(false); }}>
                <input ref={inputRef} className="field name-edit" defaultValue={world.name} maxLength={40} onBlur={(e) => { rename(e.target.value); setEditing(false); }} aria-label="World name" />
              </form>
            ) : (
              <button className="name-btn" onClick={() => setEditing(true)} title="Rename"><h1>{world.name}</h1><Icon n="edit" s={14} /></button>
            )}
            <span className="chip" style={{ ["--c" as any]: B.ui[0] }}>{B.name}</span>
          </div>
        </div>
        <div className="hud-right">
          <SaveBadge />
          <div className="hud-group">
            <button className="icon-btn glassy" onClick={undo} disabled={!past} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon n="undo" /></button>
            <button className="icon-btn glassy" onClick={redo} disabled={!future} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon n="redo" /></button>
          </div>
          <TimeMenu />
          <button className="icon-btn glassy" onClick={() => useStore.setState((s) => ({ resetCam: s.resetCam + 1 }))} aria-label="Reset camera" title="Reset camera"><Icon n="home" /></button>
          <button className="icon-btn glassy" onClick={() => useStore.setState({ settingsOpen: true })} aria-label="World settings" title="World settings"><Icon n="gear" /></button>
          <button className="btn primary" onClick={() => useStore.setState({ cinematic: true, selectedId: null })} title="Cinematic view (C)"><Icon n="eye" s={16} /> <span className="hide-s">Cinematic</span></button>
        </div>
      </motion.header>}
      </AnimatePresence>
      {!cinematic && (
        <motion.div className="hud-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Hint />
          <Dock />
        </motion.div>
      )}
      {!cinematic && <SelectionPanel />}
      <Settings />
      <Cinematic />
    </div>
  );
}
