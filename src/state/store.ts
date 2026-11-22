import { create } from "zustand";
import { BIOMES, BIOME_ORDER, randomName, TIMES } from "../data/biomes";
import { ITEMS, SIZE, type TerrainTool } from "../data/catalog";
import { CLOUD_APP, isWorld, migrate, prefs, storage } from "../data/db";
import { onCloudSession, pull, push } from "../cloud/cloud";
import { newSeed, uid } from "../data/rng";
import { carveRiver, generateStarters, generateTerrain, paint, sculpt } from "../data/terrain";
import { SCHEMA_VERSION, type BiomeId, type Draft, type Env, type ObjectKind, type Placed, type Surface, type Terrain, type World } from "../data/types";

export type Screen = "welcome" | "collection" | "create" | "builder";
export type Mode = "explore" | "place" | "terrain";
export type Brush = "S" | "M" | "L";
export const BRUSH_R: Record<Brush, number> = { S: 0.7, M: 1.3, L: 2.2 };

interface Snap { heights: number[]; surface: number[]; objects: Placed[]; env: Env }
interface Toast { id: string; title: string; text: string }
export interface Burst { id: string; x: number; y: number; z: number; t: number; kind: "place" | "remove" | "discover"; r: number }

/** set by the 3D stage: renders the current view into an image */
export const captureRef: { fn: ((w: number, h: number, type?: string) => string | null) | null } = { fn: null };

export function makeDraft(biome: BiomeId = "forest"): Draft {
  const B = BIOMES[biome];
  return { biome, name: "", size: "medium", seed: newSeed(), blank: false, env: { time: B.defaults.time, weather: B.defaults.weather, sky: "", ambient: 1 } };
}

export function buildWorld(d: Draft): World {
  const terrain = generateTerrain(d.biome, d.size, d.seed, !!d.blank);
  const now = Date.now();
  return {
    id: uid(), version: SCHEMA_VERSION, name: d.name.trim() || randomName(), biome: d.biome, seed: d.seed, size: d.size,
    env: { ...d.env }, terrain, objects: d.blank ? [] : generateStarters(terrain, d.biome, d.size, d.seed), createdAt: now, updatedAt: now,
  };
}

interface State {
  screen: Screen;
  fading: boolean;
  createStep: number;
  draft: Draft;
  worlds: World[];
  loaded: boolean;
  current: World | null;
  mode: Mode;
  placeKind: ObjectKind | null;
  ghostRot: number;
  /** size for the next thing placed */
  placeScale: number;
  music: boolean;
  terrainTool: TerrainTool;
  surface: Surface;
  brush: Brush;
  selectedId: string | null;
  hoverId: string | null;
  past: Snap[];
  future: Snap[];
  pending: Snap | null;
  save: "saved" | "saving" | "dirty";
  settingsOpen: boolean;
  cinematic: boolean;
  introAt: number;
  welcomeName: string;
  resetCam: number;
  toasts: Toast[];
  bursts: Burst[];
  justPlaced: Record<string, number>;
  discoveries: string[];
  reducedMotion: boolean;
  quality: "high" | "low";

  go: (s: Screen) => void;
  load: () => Promise<void>;
  startCreate: () => void;
  setDraft: (p: Partial<Draft>) => void;
  setDraftEnv: (p: Partial<Env>) => void;
  createFromDraft: () => Promise<void>;
  surprise: () => Promise<void>;
  openWorld: (id: string) => void;
  exitWorld: () => Promise<void>;
  renameWorld: (id: string, name: string) => void;
  duplicateWorld: (id: string) => Promise<World | null>;
  deleteWorld: (id: string) => Promise<void>;
  importWorlds: (ws: World[]) => Promise<number>;

  setMode: (m: Mode) => void;
  choosePlace: (k: ObjectKind | null) => void;
  setTerrainTool: (t: TerrainTool) => void;
  setSurface: (s: Surface) => void;
  setBrush: (b: Brush) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  rotateGhost: (d: number) => void;
  setPlaceScale: (v: number) => void;
  resizeSelected: (factor: number) => void;
  clearWorld: () => void;

  commit: (fn: (w: World) => World) => void;
  begin: () => void;
  live: (fn: (w: World) => World) => void;
  end: () => void;
  undo: () => void;
  redo: () => void;

  placeAt: (kind: ObjectKind, x: number, z: number) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  stroke: (x: number, z: number) => void;
  setEnv: (p: Partial<Env>) => void;
  renameCurrent: (name: string) => void;
  saveNow: (withThumb?: boolean) => Promise<void>;

  toast: (title: string, text: string) => void;
  dismissToast: (id: string) => void;
  discover: (key: string, title: string, text: string, at?: [number, number, number]) => void;
  burst: (b: Omit<Burst, "id" | "t">) => void;
  setPrefs: (p: Partial<Pick<State, "reducedMotion" | "quality">>) => void;
}

const snapOf = (w: World): Snap => ({ heights: w.terrain.heights, surface: w.terrain.surface, objects: w.objects, env: w.env });
const applySnap = (w: World, s: Snap): World => ({ ...w, env: s.env, objects: s.objects, terrain: { ...w.terrain, heights: s.heights, surface: s.surface } });
const sortWorlds = (l: World[]) => l.slice().sort((a, b) => b.updatedAt - a.updatedAt);
const HISTORY = 80;

let saveTimer: number | undefined;
let lastThumb = 0;

export const useStore = create<State>()((set, get) => ({
  screen: "welcome",
  fading: false,
  createStep: 0,
  draft: makeDraft(),
  worlds: [],
  loaded: false,
  current: null,
  mode: "explore",
  placeKind: null,
  ghostRot: 0,
  placeScale: 1,
  music: false,
  terrainTool: "raise",
  surface: "grass",
  brush: "M",
  selectedId: null,
  hoverId: null,
  past: [],
  future: [],
  pending: null,
  save: "saved",
  settingsOpen: false,
  cinematic: false,
  introAt: 0,
  welcomeName: "",
  resetCam: 0,
  toasts: [],
  bursts: [],
  justPlaced: {},
  discoveries: prefs.get<string[]>("discoveries", []),
  reducedMotion: prefs.get("reducedMotion", typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches),
  quality: prefs.get<"high" | "low">("quality", "high"),

  go: (s) => {
    if (get().screen === s) return;
    set({ fading: true });
    window.setTimeout(() => {
      set({ screen: s, settingsOpen: false, cinematic: false });
      window.setTimeout(() => set({ fading: false }), 60);
    }, 320);
  },

  load: async () => {
    try {
      let ws = await storage.all();
      // showcase collection: added on the first visit; untouched copies are refreshed when the showcase is updated
      const SHOWCASE_VER = 2;
      const seeded = prefs.get("seeded", false), ver = prefs.get("showcaseVer", 0);
      if ((!seeded || ver < SHOWCASE_VER) && !location.search.includes("empty")) {
        try {
          const res = await fetch("./showcase.json");
          if (res.ok) {
            const data = await res.json();
            const byId = new Map(ws.map((w) => [w.id, w]));
            for (const w of (data.worlds ?? []) as World[]) {
              if (!isWorld(w)) continue;
              const have = byId.get(w.id);
              if ((!have && !seeded) || (have && have.updatedAt === w.updatedAt)) { await storage.put(w, false); byId.set(w.id, w); } // the cloud sync uploads only what's newer
            }
            ws = Array.from(byId.values());
            prefs.set("showcaseVer", SHOWCASE_VER);
          }
        } catch { /* offline: keep what we have */ }
        prefs.set("seeded", true);
      }
      set({ worlds: sortWorlds(ws), loaded: true });
    } catch { set({ loaded: true }); }
  },

  startCreate: () => { set({ draft: makeDraft(BIOME_ORDER[0]), createStep: 0 }); get().go("create"); },
  setDraft: (p) => set((s) => {
    const d = { ...s.draft, ...p };
    if (p.biome && p.biome !== s.draft.biome) {
      const B = BIOMES[p.biome];
      d.env = { ...d.env, time: B.defaults.time, weather: B.defaults.weather };
    }
    return { draft: d };
  }),
  setDraftEnv: (p) => set((s) => ({ draft: { ...s.draft, env: { ...s.draft.env, ...p } } })),

  createFromDraft: async () => {
    const w = buildWorld(get().draft);
    await storage.put(w);
    set((s) => ({ worlds: sortWorlds([w, ...s.worlds]) }));
    get().openWorld(w.id);
    window.setTimeout(() => get().discover("first-world", "A new universe is born", `Welcome to ${w.name}. It's yours.`), 3600);
  },
  surprise: async () => {
    const biome = BIOME_ORDER[Math.floor(Math.random() * BIOME_ORDER.length)];
    const B = BIOMES[biome];
    const d = makeDraft(biome);
    d.name = randomName();
    d.size = (["small", "medium", "large"] as const)[Math.floor(Math.random() * 3)];
    d.env.time = TIMES[Math.floor(Math.random() * TIMES.length)];
    d.env.weather = Math.random() < 0.3 ? B.weathers[Math.floor(Math.random() * B.weathers.length)] : "clear";
    set({ draft: d });
    await get().createFromDraft();
  },

  openWorld: (id) => {
    const w = get().worlds.find((x) => x.id === id);
    if (!w) return;
    set({
      current: structuredClone(w), past: [], future: [], pending: null, selectedId: null, hoverId: null, mode: "explore", placeKind: null,
      save: "saved", welcomeName: w.name, introAt: performance.now() + 360, justPlaced: {}, bursts: [],
    });
    lastThumb = 0;
    get().go("builder");
  },
  exitWorld: async () => {
    await get().saveNow(true);
    set({ selectedId: null, mode: "explore", placeKind: null });
    get().go("collection");
    window.setTimeout(() => set({ current: null }), 400);
  },
  renameWorld: (id, name) => {
    name = name.trim(); if (!name) return;
    const cur = get().current;
    if (cur && cur.id === id) { get().renameCurrent(name); return; }
    const w = get().worlds.find((x) => x.id === id); if (!w) return;
    const nw = { ...w, name, updatedAt: Date.now() };
    storage.put(nw);
    set((s) => ({ worlds: sortWorlds(s.worlds.map((x) => (x.id === id ? nw : x))) }));
  },
  duplicateWorld: async (id) => {
    const w = get().worlds.find((x) => x.id === id); if (!w) return null;
    const now = Date.now();
    const copy: World = { ...structuredClone(w), id: uid(), name: w.name + " (copy)", createdAt: now, updatedAt: now };
    copy.objects = copy.objects.map((o) => ({ ...o, id: uid() }));
    await storage.put(copy);
    set((s) => ({ worlds: sortWorlds([copy, ...s.worlds]) }));
    return copy;
  },
  deleteWorld: async (id) => {
    await storage.remove(id);
    set((s) => ({ worlds: s.worlds.filter((x) => x.id !== id) }));
  },
  importWorlds: async (ws) => {
    const now = Date.now();
    const fresh = ws.map((w, i) => ({ ...w, id: uid(), objects: w.objects.map((o) => ({ ...o, id: o.id || uid() })), updatedAt: now + i }));
    for (const w of fresh) await storage.put(w);
    set((s) => ({ worlds: sortWorlds([...fresh, ...s.worlds]) }));
    return fresh.length;
  },

  setMode: (m) => set({ mode: m, placeKind: m === "place" ? get().placeKind : null, selectedId: m === "explore" ? get().selectedId : null }),
  choosePlace: (k) => set({ placeKind: k, mode: k ? "place" : "explore", selectedId: null }),
  setTerrainTool: (t) => set({ terrainTool: t, mode: "terrain", placeKind: null, selectedId: null }),
  setSurface: (sf) => set({ surface: sf, terrainTool: "paint", mode: "terrain", placeKind: null, selectedId: null }),
  setBrush: (b) => set({ brush: b }),
  select: (id) => set({ selectedId: id }),
  hover: (id) => { if (get().hoverId !== id) set({ hoverId: id }); },
  rotateGhost: (d) => set((s) => ({ ghostRot: s.ghostRot + d })),
  setPlaceScale: (v) => set({ placeScale: Math.min(SIZE[1], Math.max(SIZE[0], Math.round(v * 100) / 100)) }),
  resizeSelected: (f) => {
    const id = get().selectedId; if (!id) return;
    get().commit((w) => ({ ...w, objects: w.objects.map((x) => (x.id === id ? { ...x, s: Math.min(SIZE[1], Math.max(SIZE[0], Math.round(x.s * f * 100) / 100)) } : x)) }));
  },
  clearWorld: () => {
    const cur = get().current; if (!cur) return;
    const t = generateTerrain(cur.biome, cur.size, cur.seed, true);
    get().commit((w) => ({ ...w, objects: [], terrain: { ...w.terrain, heights: t.heights, surface: t.surface } }));
    set({ selectedId: null });
  },

  commit: (fn) => {
    const cur = get().current; if (!cur) return;
    set((s) => ({ past: [...s.past.slice(-HISTORY + 1), snapOf(cur)], future: [], current: fn(cur) }));
  },
  begin: () => { const cur = get().current; if (cur) set({ pending: snapOf(cur) }); },
  live: (fn) => { const cur = get().current; if (cur) set({ current: fn(cur) }); },
  end: () => {
    const { pending, current } = get();
    if (!pending || !current) return;
    const changed = pending.heights !== current.terrain.heights || pending.surface !== current.terrain.surface || pending.objects !== current.objects || pending.env !== current.env;
    set((s) => ({ pending: null, ...(changed ? { past: [...s.past.slice(-HISTORY + 1), pending], future: [] } : {}) }));
  },
  undo: () => {
    const { past, current } = get(); if (!past.length || !current) return;
    const prev = past[past.length - 1];
    set((s) => ({ past: s.past.slice(0, -1), future: [snapOf(current), ...s.future], current: applySnap(current, prev), selectedId: null }));
  },
  redo: () => {
    const { future, current } = get(); if (!future.length || !current) return;
    const next = future[0];
    set((s) => ({ future: s.future.slice(1), past: [...s.past, snapOf(current)], current: applySnap(current, next), selectedId: null }));
  },

  placeAt: (kind, x, z) => {
    const cur = get().current; if (!cur) return;
    const item = ITEMS[kind];
    const o: Placed = { id: uid(), kind, p: [x, item.lift ?? 0, z], r: get().ghostRot, s: get().placeScale, v: Math.floor(Math.random() * 1000) };
    get().commit((w) => ({ ...w, objects: [...w.objects, o] }));
    set((s) => ({ justPlaced: { ...s.justPlaced, [o.id]: performance.now() } }));
    get().burst({ x, y: 0, z, kind: "place", r: item.r });
    // discovery moments
    const at: [number, number, number] = [x, 0, z];
    if (kind === "tree" || kind === "pine") get().discover("first-tree", "Your first tree", "Something is starting to grow here.", at);
    if (kind === "cottage" || kind === "cabin") get().discover("first-home", "A home of your own", "Someone could live happily here.", at);
    if (["roundhut", "manor", "mushhouse", "treehouse"].includes(kind)) get().discover("first-home", "A home of your own", "Someone could live happily here.", at);
    if (["man", "woman", "dog", "gnome"].includes(kind)) get().discover("first-friend", "Someone moved in", "Your world has its first little resident.", at);
    if (["crystal", "lantern", "magictree", "stars", "portal", "fairylights", "fairy", "glitter", "hangingtree"].includes(kind)) get().discover("first-magic", "A little magic", "Your world just got a spark brighter.", at);
    if (cur.objects.length + 1 >= 60) get().discover("sixty", "A thriving world", "Sixty things live in your universe now.");
  },
  removeSelected: () => {
    const id = get().selectedId, cur = get().current; if (!id || !cur) return;
    const o = cur.objects.find((x) => x.id === id); if (!o) return;
    get().commit((w) => ({ ...w, objects: w.objects.filter((x) => x.id !== id) }));
    get().burst({ x: o.p[0], y: 0, z: o.p[2], kind: "remove", r: ITEMS[o.kind].r * o.s });
    set({ selectedId: null });
  },
  duplicateSelected: () => {
    const id = get().selectedId, cur = get().current; if (!id || !cur) return;
    const o = cur.objects.find((x) => x.id === id); if (!o) return;
    const off = ITEMS[o.kind].r * o.s * 1.6 + 0.3;
    const c: Placed = { ...o, id: uid(), p: [o.p[0] + off, o.p[1], o.p[2] + off * 0.3], v: Math.floor(Math.random() * 1000) };
    get().commit((w) => ({ ...w, objects: [...w.objects, c] }));
    set((s) => ({ selectedId: c.id, justPlaced: { ...s.justPlaced, [c.id]: performance.now() } }));
  },
  stroke: (x, z) => {
    const { current: cur, terrainTool, surface, brush } = get(); if (!cur) return;
    const R = BRUSH_R[brush];
    const t: Terrain = cur.terrain;
    if (terrainTool === "paint") get().live((w) => ({ ...w, terrain: { ...t, surface: paint(t, x, z, R, surface) } }));
    else if (terrainTool === "river") {
      get().live((w) => ({ ...w, terrain: { ...t, heights: carveRiver(t, x, z, R * 0.8) } }));
      get().discover("first-river", "A river runs through it", "Water fills whatever you dig below the shore.", [x, 0, z]);
    } else if (terrainTool === "erase") {
      const gone = cur.objects.filter((o) => Math.hypot(o.p[0] - x, o.p[2] - z) < R * 0.85 + ITEMS[o.kind].r * o.s * 0.4);
      if (!gone.length) return;
      const ids = new Set(gone.map((o) => o.id));
      get().live((w) => ({ ...w, objects: w.objects.filter((o) => !ids.has(o.id)) }));
      for (const o of gone.slice(0, 4)) get().burst({ x: o.p[0], y: 0, z: o.p[2], kind: "remove", r: ITEMS[o.kind].r * o.s });
    } else get().live((w) => ({ ...w, terrain: { ...t, heights: sculpt(t, x, z, R, terrainTool as "raise" | "lower" | "smooth", terrainTool === "smooth" ? 0.25 : 0.09) } }));
  },
  setEnv: (p) => {
    get().commit((w) => ({ ...w, env: { ...w.env, ...p } }));
    if (p.time === "night") get().discover("first-night", "Night falls", "Look closely: the windows and fireflies are glowing.");
  },
  renameCurrent: (name) => {
    name = name.trim(); if (!name) return;
    const cur = get().current; if (!cur) return;
    set({ current: { ...cur, name } });
  },
  saveNow: async (withThumb) => {
    const cur = get().current; if (!cur) return;
    window.clearTimeout(saveTimer);
    let thumb = cur.thumb;
    if ((withThumb || performance.now() - lastThumb > 15000) && captureRef.fn) {
      const t = captureRef.fn(480, 300, "image/jpeg");
      if (t) { thumb = t; lastThumb = performance.now(); }
    }
    const w: World = { ...cur, thumb, updatedAt: Date.now() };
    set({ save: "saving" });
    try {
      await storage.put(w);
      set((s) => ({ save: s.current === cur || !s.current ? "saved" : "dirty", worlds: sortWorlds([w, ...s.worlds.filter((x) => x.id !== w.id)]), current: s.current && s.current.id === w.id ? { ...s.current, thumb } : s.current }));
    } catch {
      set({ save: "dirty" });
    }
  },

  toast: (title, text) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, title, text }] }));
    window.setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  discover: (key, title, text, at) => {
    if (get().discoveries.includes(key)) return;
    const d = [...get().discoveries, key];
    prefs.set("discoveries", d);
    set({ discoveries: d });
    get().toast(title, text);
    if (at) get().burst({ x: at[0], y: at[1], z: at[2], kind: "discover", r: 1 });
  },
  burst: (b) => {
    const id = uid();
    set((s) => ({ bursts: [...s.bursts.slice(-8), { ...b, id, t: performance.now() }] }));
    window.setTimeout(() => set((s) => ({ bursts: s.bursts.filter((x) => x.id !== id) })), 1400);
  },
  setPrefs: (p) => {
    if (p.reducedMotion !== undefined) prefs.set("reducedMotion", p.reducedMotion);
    if (p.quality) prefs.set("quality", p.quality);
    set(p as Partial<State>);
  },
}));

// autosave: any change to the open world is written to IndexedDB shortly after
useStore.subscribe((s, prev) => {
  if (!s.current || s.current === prev.current || s.screen !== "builder") return;
  if (prev.current && prev.current.id !== s.current.id) return;
  if (prev.current === null) return;
  if (s.current.thumb !== prev.current.thumb && s.current.objects === prev.current.objects && s.current.terrain === prev.current.terrain && s.current.env === prev.current.env && s.current.name === prev.current.name) return;
  if (s.save !== "dirty" && s.save !== "saving") useStore.setState({ save: "dirty" });
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { if (!useStore.getState().pending) useStore.getState().saveNow(); else saveTimer = window.setTimeout(() => useStore.getState().saveNow(), 900); }, 700);
});

// Cloud save: when signed in, combine this browser's worlds with the cloud copy.
// For each world the most recently edited copy wins; a world deleted on one device is deleted everywhere
// (unless it was edited again after that).
export function mergeWorlds(local: World[], rows: { key: string; data: any; updated_at: number; deleted: boolean }[]) {
  const byId = new Map(local.map((w) => [w.id, w]));
  const toLocal: World[] = [], removeLocal: string[] = [], toCloud: World[] = [];
  const remote = new Map(rows.map((r) => [r.key, r]));
  for (const r of rows) {
    const l = byId.get(r.key);
    if (r.deleted) { if (l && l.updatedAt <= r.updated_at) { removeLocal.push(r.key); byId.delete(r.key); } continue; }
    if (!isWorld(r.data)) continue;
    if (!l || r.updated_at > l.updatedAt) { const w = migrate({ ...r.data, id: r.key, updatedAt: r.updated_at }); toLocal.push(w); byId.set(w.id, w); }
  }
  for (const l of local) {
    const r = remote.get(l.id);
    if (!byId.has(l.id)) continue;
    if (!r || l.updatedAt > r.updated_at) toCloud.push(l);
  }
  return { worlds: [...byId.values()], toLocal, removeLocal, toCloud };
}

onCloudSession(async () => {
  for (let i = 0; i < 100 && !useStore.getState().loaded; i++) await new Promise((r) => setTimeout(r, 100));
  const rows = await pull(CLOUD_APP);
  const local = await storage.all();
  const m = mergeWorlds(local, rows);
  for (const w of m.toLocal) await storage.put(w, false);
  for (const id of m.removeLocal) await storage.remove(id, false);
  for (const w of m.toCloud) push(CLOUD_APP, w.id, w, w.updatedAt);
  if (m.toLocal.length || m.removeLocal.length) {
    const cur = useStore.getState().current;
    useStore.setState({ worlds: sortWorlds(m.worlds) });
    if (m.toLocal.length + m.removeLocal.length) useStore.getState().toast("Synced from the cloud", `${m.toLocal.length ? m.toLocal.length + " world" + (m.toLocal.length > 1 ? "s" : "") + " updated" : ""}${m.toLocal.length && m.removeLocal.length ? " · " : ""}${m.removeLocal.length ? m.removeLocal.length + " removed" : ""}.`);
    void cur;
  }
});
