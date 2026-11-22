import { useEffect, useState } from "react";
import { create } from "zustand";
import { cloud, cloudConfigured, phoneEnabled, runSync, sendPhoneCode, signIn, signOut, signUp, verifyPhoneCode, type CloudState } from "../cloud/cloud";
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
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  if (!cloudConfigured) return null;
  const usePhone = phoneEnabled() && method === "phone";
  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    if (!sent) { const m = await sendPhoneCode(phone); setBusy(false); setMsg(m); if (!m) setSent(true); return; }
    const m = await verifyPhoneCode(phone, code); setBusy(false); setMsg(m);
    if (!m) { setCode(""); setSent(false); }
  };
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
        <p className="muted">Sign in to keep your worlds in <b>Pocket Universe</b> on every device — phone, laptop or tablet.</p>
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
          <>
          {phoneEnabled() && (
            <div className="seg">
              <button type="button" className={method === "email" ? "on" : ""} onClick={() => { setMethod("email"); setMsg(""); }}>Email</button>
              <button type="button" className={method === "phone" ? "on" : ""} onClick={() => { setMethod("phone"); setMsg(""); }}>Mobile number</button>
            </div>
          )}
          {usePhone ? (
            <form className="cloud-form" onSubmit={submitPhone}>
              <input className="field" type="tel" required autoComplete="tel" inputMode="tel" placeholder="Mobile number, e.g. 98765 43210" value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value)} />
              {sent && <input className="field" type="text" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="6-digit code from the text message" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
              {msg && <p className="cloud-msg">{msg}</p>}
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "One moment…" : sent ? "Verify and sign in" : "Send code"}</button>
              {sent && <button type="button" className="btn ghost small" onClick={() => { setSent(false); setCode(""); setMsg(""); }}>Change number or send a new code</button>}
              <p className="muted small">We text you a one-time code — no password needed. The first time, this creates your account.</p>
            </form>
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
          </>
        )}
      </div>
    </Modal>
  );
}
