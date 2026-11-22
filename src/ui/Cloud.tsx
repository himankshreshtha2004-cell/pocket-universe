import { useEffect, useState } from "react";
import { create } from "zustand";
import { cloud, cloudConfigured, runSync, signIn, signOut, signUp, type CloudState } from "../cloud/cloud";
import { Modal } from "./common";
import { Icon } from "./icons";

export const useCloudUI = create<{ open: boolean }>(() => ({ open: false }));
export const openCloud = (open = true) => useCloudUI.setState({ open });

export function useCloud(): CloudState {
  const [s, setS] = useState(cloud.state);
  useEffect(() => cloud.subscribe(setS), []);
  return s;
}
export function cloudLine(s: CloudState): string {
  if (s.status === "off") return "Off";
  if (s.status === "signed-out") return "Cloud save";
  if (s.status === "syncing") return "Syncing…";
  if (s.status === "error") return "Not synced";
  return "Synced";
}

/** small pill for headers: opens the cloud sheet */
export function CloudButton({ small }: { small?: boolean }) {
  const s = useCloud();
  if (!cloudConfigured) return null;
  return (
    <button className={"btn glassy cloud-btn " + s.status + (small ? " small" : "")} onClick={() => openCloud()} title={s.email ? `Signed in as ${s.email}` : "Save your worlds to the cloud"}>
      <Icon n="cloud" s={16} /> {cloudLine(s)}
    </button>
  );
}

export function CloudSheet() {
  const s = useCloud();
  const open = useCloudUI((u) => u.open);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!cloudConfigured) return null;
  const close = () => { openCloud(false); setMsg(""); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const m = mode === "in" ? await signIn(email, pw) : await signUp(email, pw);
    setBusy(false); setMsg(m);
    if (!m) setPw("");
  };
  const ago = s.lastSync ? Math.round((Date.now() - s.lastSync) / 60000) : -1;
  return (
    <Modal open={open} onClose={close} title="Cloud save">
      <div className="cloud-sheet">
        <p className="muted">One account keeps your worlds in <b>Pocket Universe</b> and your progress in <b>The Impossible Path</b> — on any device.</p>
        {s.email ? (
          <>
            <div className="cloud-who"><Icon n="cloud" s={18} /><div><b>{s.email}</b><span className={"cloud-st " + s.status}>{s.status === "synced" ? (ago < 1 ? "Synced just now" : `Synced ${ago} min ago`) : s.status === "syncing" ? "Syncing…" : "Not synced"}</span></div></div>
            {s.status === "error" && s.message && <p className="cloud-msg">{s.message}</p>}
            <p className="muted small">Every change to a world is copied to the cloud a few seconds later. Sign in with the same account on another device to see your worlds there.</p>
            <div className="row gap-s">
              <button className="btn glassy" disabled={s.status === "syncing"} onClick={() => runSync()}><Icon n="rotr" s={15} /> Sync now</button>
              <button className="btn ghost" onClick={() => signOut()}>Sign out</button>
              <span className="grow" />
              <button className="btn primary" onClick={close}>Done</button>
            </div>
          </>
        ) : (
          <form className="cloud-form" onSubmit={submit}>
            <div className="seg">
              <button type="button" className={mode === "in" ? "on" : ""} onClick={() => { setMode("in"); setMsg(""); }}>Sign in</button>
              <button type="button" className={mode === "up" ? "on" : ""} onClick={() => { setMode("up"); setMsg(""); }}>Create account</button>
            </div>
            <input className="field" type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="field" type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder={mode === "in" ? "Password" : "Choose a password (6+ characters)"} value={pw} onChange={(e) => setPw(e.target.value)} />
            {msg && <p className="cloud-msg">{msg}</p>}
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</button>
            <p className="muted small">The worlds already on this device are kept and added to your cloud — nothing is lost.</p>
          </form>
        )}
      </div>
    </Modal>
  );
}
