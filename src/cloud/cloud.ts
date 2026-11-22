// Cloud save — the same module is used by The Impossible Path and Pocket Universe; each game
// points at its own free Supabase project (set in cloud-config.js). Everything still saves in the browser first; the cloud is a copy that
// follows you to other devices.
//
// Turn it on by filling in cloud-config.js (next to index.html):
//   window.CLOUD_CONFIG = { url: "https://xxxx.supabase.co", anonKey: "<anon / publishable key>" }
// The anon key is meant to be public — row-level security keeps every player's saves private.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CloudStatus = "off" | "signed-out" | "syncing" | "synced" | "error";
export interface CloudState { status: CloudStatus; email: string; lastSync: number; message: string }
export interface CloudRow { key: string; data: any; updated_at: number; deleted: boolean }

const cfg = (typeof window !== "undefined" ? (window as any).CLOUD_CONFIG : null) as { url?: string; anonKey?: string; phone?: boolean; country?: string; afterConfirm?: string } | null;
/** mobile-number sign-in is shown only when cloud-config.js says phone: true (it needs an SMS provider in Supabase) */
export const phoneEnabled = () => !!(cfg && cfg.phone);
export const cloudConfigured = !!(cfg && cfg.url && cfg.anonKey && /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(cfg.url));

let sb: SupabaseClient | null = null;
try {
  if (cloudConfigured) sb = createClient(cfg!.url!.replace(/\/+$/, ""), cfg!.anonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "cloud-save-auth" },
  });
} catch (e) { console.warn("Cloud save disabled:", e); sb = null; }

let state: CloudState = { status: sb ? "signed-out" : "off", email: "", lastSync: 0, message: "" };
const listeners = new Set<(s: CloudState) => void>();
const set = (p: Partial<CloudState>) => { state = { ...state, ...p }; listeners.forEach((f) => f(state)); };
export const cloud = {
  get state() { return state; },
  subscribe(fn: (s: CloudState) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

let userId = "";
const syncers: (() => Promise<void>)[] = [];
/** an app registers how to merge its saves; it runs whenever a session starts (page load or sign-in) */
export function onCloudSession(fn: () => Promise<void>) { syncers.push(fn); if (userId) runSync(); }

let syncing: Promise<void> | null = null;
export function runSync(): Promise<void> {
  if (!sb || !userId) return Promise.resolve();
  if (syncing) return syncing;
  set({ status: "syncing", message: "" });
  syncing = (async () => {
    try {
      for (const f of syncers) await f();
      await flush();
      set({ status: "synced", lastSync: Date.now() });
    } catch (e: any) {
      set({ status: "error", message: friendly(e) });
    } finally { syncing = null; }
  })();
  return syncing;
}

function friendly(e: any): string {
  const m = String(e?.message || e || "");
  if (/fetch|network|Failed to fetch/i.test(m)) return "Can't reach the cloud — you're probably offline. Progress is still saved on this device.";
  if (/relation .*saves.* does not exist|42P01/i.test(m)) return "The cloud isn't set up yet: the 'saves' table is missing (run the setup SQL).";
  if (/Invalid login/i.test(m)) return "Wrong email or password.";
  if (/already registered|already been registered/i.test(m)) return "That email already has an account — sign in instead.";
  if (/Password should be/i.test(m)) return "Use a password of at least 6 characters.";
  if (/Email not confirmed/i.test(m)) return "Confirm your email first (check your inbox), then sign in.";
  if (/rate limit|only request this after|security purposes/i.test(m)) return "Too many tries — wait a minute and try again.";
  if (/phone provider|Unsupported phone|sms provider|Error sending (confirmation|sms|otp)/i.test(m)) return "Mobile sign-in isn't switched on yet — it needs an SMS service in Supabase. Use email for now.";
  if (/Token has expired|invalid.*otp|otp.*invalid|Token.*invalid/i.test(m)) return "That code is wrong or has expired. Check it, or send a new one.";
  if (/Invalid phone|phone.*invalid|phone number format/i.test(m)) return "Enter a valid mobile number, e.g. 98765 43210 (or with +country code).";
  return m || "Something went wrong with the cloud.";
}

if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    const id = session?.user?.id || "";
    const email = session?.user?.email || (session?.user?.phone ? "+" + String(session.user.phone).replace(/^\+/, "") : "");
    if (id && id !== userId) { userId = id; set({ email, status: "syncing" }); window.setTimeout(runSync, 0); }
    else if (!id && userId) { userId = ""; set({ email: "", status: "signed-out", lastSync: 0 }); }
    else if (!id && event === "INITIAL_SESSION") set({ status: "signed-out" });
  });
}

export async function signUp(email: string, password: string): Promise<string> {
  if (!sb) return "Cloud save isn't set up on this site.";
  // the confirmation email brings the player back to this game (its address must be in Supabase → Auth → URL Configuration)
  const back = cfg?.afterConfirm || (typeof location !== "undefined" ? location.origin + location.pathname : undefined);
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: back ? { emailRedirectTo: back } : undefined });
  if (error) return friendly(error);
  if (!data.session) return "Account created. Check your email and click the confirmation link, then sign in here.";
  return "";
}
export async function signIn(email: string, password: string): Promise<string> {
  if (!sb) return "Cloud save isn't set up on this site.";
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  return error ? friendly(error) : "";
}
/** "98765 43210" → "+919876543210"; numbers that already start with + keep their country code */
export function normalizePhone(raw: string): string {
  const t = raw.trim().replace(/[\s\-().]/g, "");
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D/g, "");
  const d = t.replace(/\D/g, "").replace(/^0+/, "");
  const cc = String(cfg?.country || "91").replace(/\D/g, "");
  return d.length === 10 ? "+" + cc + d : "+" + d;
}
/** step 1 of mobile sign-in: text a 6-digit code (creates the account the first time) */
export async function sendPhoneCode(phone: string): Promise<string> {
  if (!sb) return "Cloud save isn't set up on this site.";
  const p = normalizePhone(phone);
  if (p.replace(/\D/g, "").length < 10) return "Enter a valid mobile number, e.g. 98765 43210.";
  const { error } = await sb.auth.signInWithOtp({ phone: p });
  return error ? friendly(error) : "";
}
/** step 2: check the code from the text message */
export async function verifyPhoneCode(phone: string, code: string): Promise<string> {
  if (!sb) return "Cloud save isn't set up on this site.";
  const { error } = await sb.auth.verifyOtp({ phone: normalizePhone(phone), token: code.replace(/\D/g, ""), type: "sms" });
  return error ? friendly(error) : "";
}
export async function signOut() { await flush().catch(() => {}); await sb?.auth.signOut(); }

/** every saved row of one app for the signed-in player */
export async function pull(app: string): Promise<CloudRow[]> {
  if (!sb || !userId) return [];
  const { data, error } = await sb.from("saves").select("key,data,updated_at,deleted").eq("app", app);
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, updated_at: Number(r.updated_at) || 0 }));
}

// writes are batched: the newest version of each key goes up a couple of seconds after the last change
const queue = new Map<string, { app: string; key: string; data: any; updated_at: number; deleted: boolean }>();
let timer = 0;
export function push(app: string, key: string, data: any, updatedAt = Date.now(), deleted = false) {
  if (!sb || !userId) return;
  queue.set(app + "\u0000" + key, { app, key, data: deleted ? null : data, updated_at: Math.round(updatedAt), deleted });
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { flush().catch(() => {}); }, 2500);
}
export async function flush() {
  if (!sb || !userId || !queue.size) return;
  const rows = [...queue.values()].map((r) => ({ ...r, user_id: userId }));
  queue.clear();
  const prev = state.status;
  if (prev !== "syncing") set({ status: "syncing" });
  const { error } = await sb.from("saves").upsert(rows, { onConflict: "user_id,app,key" });
  if (error) {
    // keep them for the next try (unless newer versions were queued meanwhile)
    for (const r of rows) { const k = r.app + "\u0000" + r.key; if (!queue.has(k)) queue.set(k, r); }
    set({ status: "error", message: friendly(error) });
    throw error;
  }
  set({ status: "synced", lastSync: Date.now(), message: "" });
}
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush().catch(() => {}); });
  window.addEventListener("online", () => { if (userId) runSync(); });
}
