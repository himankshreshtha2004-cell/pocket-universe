// Local persistence: IndexedDB (one record per world), with a localStorage fallback
// for browsers or modes where IndexedDB is unavailable.
import { SCHEMA_VERSION, type World } from "./types";
import { push } from "../cloud/cloud";

export const CLOUD_APP = "pocket-universe";

const DB = "pocket-universe", STORE = "worlds", LS_KEY = "pocket-universe.worlds";
let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      if (!("indexedDB" in window)) return res(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" }); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
      req.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}

function lsAll(): World[] { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function lsWrite(list: World[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* storage full */ } }

export const storage = {
  kind: "indexeddb" as "indexeddb" | "localstorage",
  async all(): Promise<World[]> {
    const db = await open();
    if (!db) { this.kind = "localstorage"; return lsAll().map(migrate); }
    return new Promise((res, rej) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      r.onsuccess = () => res((r.result as World[]).map(migrate));
      r.onerror = () => rej(r.error);
    });
  },
  /** saves a world in this browser and (when signed in) queues a copy for the cloud */
  async put(w: World, toCloud = true): Promise<void> {
    if (toCloud) push(CLOUD_APP, w.id, w, w.updatedAt);
    const db = await open();
    if (!db) { const l = lsAll().filter((x) => x.id !== w.id); l.push(w); lsWrite(l); return; }
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(w);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async remove(id: string, toCloud = true): Promise<void> {
    if (toCloud) push(CLOUD_APP, id, null, Date.now(), true); // a "deleted" marker so other devices remove it too
    const db = await open();
    if (!db) { lsWrite(lsAll().filter((x) => x.id !== id)); return; }
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
};

/** bring older saves up to the current schema */
export function migrate(w: World): World {
  if (!w.version) w.version = SCHEMA_VERSION;
  return w;
}

export function isWorld(x: any): x is World {
  return x && typeof x === "object" && typeof x.name === "string" && typeof x.biome === "string" &&
    x.terrain && Array.isArray(x.terrain.heights) && Array.isArray(x.objects) && x.env;
}

/** small persistent flags (discoveries, preferences) */
export const prefs = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem("pocket-universe." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem("pocket-universe." + k, JSON.stringify(v)); } catch { /* ignore */ } },
};
