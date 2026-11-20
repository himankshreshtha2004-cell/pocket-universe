import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BIOME_ORDER, BIOMES, NAME_EXAMPLES, randomName, SKY_TINTS, TIME_LABEL, TIMES, WEATHER_LABEL } from "../data/biomes";
import { newSeed } from "../data/rng";
import { SIZE_LABEL } from "../data/terrain";
import type { BiomeId, WorldSize } from "../data/types";
import { buildWorld, makeDraft, useStore } from "../state/store";
import { Island } from "../three/Island";
import { thumb } from "../three/Thumbs";
import { Icon } from "./icons";

const SEEDS: Record<BiomeId, number> = { forest: 1204, islands: 77, ocean: 3311, snow: 908, desert: 4512, candy: 615 };
function useBiomeThumb(b: BiomeId) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const d = makeDraft(b); d.seed = SEEDS[b]; d.size = "small"; d.name = "sample";
    const w = buildWorld(d);
    thumb("biome-" + b, <Island world={w} thumb />, { w: 300, h: 200, dir: [1, 0.62, 1.15], pad: 0.72 }).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [b]);
  return url;
}

function BiomeCard({ b, selected, onPick, onHover }: { b: BiomeId; selected: boolean; onPick: () => void; onHover: () => void }) {
  const url = useBiomeThumb(b), B = BIOMES[b];
  return (
    <button className={"biome-card" + (selected ? " on" : "")} onClick={onPick} onPointerEnter={onHover} onFocus={onHover}
      style={{ ["--a" as any]: B.ui[0], ["--b" as any]: B.ui[1] }} aria-pressed={selected}>
      <span className="bc-art">{url ? <motion.img src={url} alt="" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} draggable={false} /> : <span className="shimmer" />}</span>
      <span className="bc-text"><b>{B.name}</b><small>{B.blurb}</small></span>
    </button>
  );
}

const STEPS = ["World", "Name", "Atmosphere"];
const TIME_ICON = { morning: "sunrise", afternoon: "sun", sunset: "sunset", night: "moon" } as const;

export function Create() {
  const step = useStore((s) => s.createStep), draft = useStore((s) => s.draft), setDraft = useStore((s) => s.setDraft), setEnv = useStore((s) => s.setDraftEnv);
  const go = useStore((s) => s.go), create = useStore((s) => s.createFromDraft);
  const setStep = (n: number) => useStore.setState({ createStep: n });
  const [ph, setPh] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setPh((p) => (p + 1) % NAME_EXAMPLES.length), 2600); return () => window.clearInterval(t); }, []);
  const B = BIOMES[draft.biome];
  const enter = async () => { if (busy) return; setBusy(true); if (!draft.name.trim()) setDraft({ name: randomName() }); await create(); setBusy(false); };

  return (
    <div className="screen create">
      <header className="create-head">
        <button className="icon-btn glassy" onClick={() => (step === 0 ? go("welcome") : setStep(step - 1))} aria-label="Back"><Icon n="back" /></button>
        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>
              <button onClick={() => i < step && setStep(i)} disabled={i > step}><span>{i < step ? <Icon n="check" s={12} w={2.6} /> : i + 1}</span>{s}</button>
            </li>
          ))}
        </ol>
      </header>

      <AnimatePresence mode="wait">
        <motion.section key={step} className={"create-panel step-" + step} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
          {step === 0 && (
            <>
              <p className="eyebrow">Step 1</p>
              <h1>Choose your world</h1>
              <p className="muted">Each one has its own land, light, plants and little inhabitants.</p>
              <div className="biome-grid">
                {BIOME_ORDER.map((b) => (
                  <BiomeCard key={b} b={b} selected={draft.biome === b} onHover={() => setDraft({ biome: b })} onPick={() => { setDraft({ biome: b }); setStep(1); }} />
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <p className="eyebrow">Step 2 · {B.name}</p>
              <h1>Name your world</h1>
              <form className="name-row" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                <input className="field big" autoFocus value={draft.name} maxLength={40} placeholder={NAME_EXAMPLES[ph]} onChange={(e) => setDraft({ name: e.target.value })} aria-label="World name" />
                <button type="button" className="icon-btn glassy big" onClick={() => setDraft({ name: randomName() })} aria-label="Random name" title="Random name"><Icon n="dice" s={20} /></button>
              </form>
              <div className="chips">
                {NAME_EXAMPLES.map((n) => <button key={n} className="chip-btn" onClick={() => setDraft({ name: n })}>{n}</button>)}
              </div>
              <div className="panel-foot">
                <button className="btn primary" onClick={() => { if (!draft.name.trim()) setDraft({ name: NAME_EXAMPLES[ph] }); setStep(2); }}>Continue <Icon n="next" s={16} /></button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="eyebrow">Step 3 · {draft.name || "Your world"}</p>
              <h1>Set the atmosphere</h1>
              <div className="field-group">
                <label>Time of day</label>
                <div className="seg four">
                  {TIMES.map((t) => <button key={t} className={draft.env.time === t ? "on" : ""} onClick={() => setEnv({ time: t })}><Icon n={TIME_ICON[t]} s={16} />{TIME_LABEL[t]}</button>)}
                </div>
              </div>
              <div className="field-group">
                <label>Weather</label>
                <div className="seg">
                  {B.weathers.map((w) => <button key={w} className={draft.env.weather === w ? "on" : ""} onClick={() => setEnv({ weather: w })}><Icon n={w} s={16} />{WEATHER_LABEL[w]}</button>)}
                </div>
              </div>
              <div className="field-group">
                <label>Sky colour</label>
                <div className="swatches">
                  {SKY_TINTS.map((c) => (
                    <button key={c || "none"} className={"swatch" + (draft.env.sky === c ? " on" : "")} style={{ background: c || "conic-gradient(#5f95e6, #f6a98a, #8177c9, #5f95e6)" }} onClick={() => setEnv({ sky: c })} aria-label={c ? `Sky tint ${c}` : "Natural sky"} title={c ? c : "Natural"} />
                  ))}
                  <label className="swatch custom" title="Pick any colour" style={{ background: draft.env.sky && !SKY_TINTS.includes(draft.env.sky) ? draft.env.sky : undefined }}>
                    <Icon n="plus" s={14} /><input type="color" value={draft.env.sky || "#a9c9f5"} onChange={(e) => setEnv({ sky: e.target.value })} aria-label="Custom sky colour" />
                  </label>
                </div>
              </div>
              <div className="field-group">
                <label>Ambient light <span className="muted">{Math.round(draft.env.ambient * 100)}%</span></label>
                <input type="range" min={0.5} max={1.5} step={0.05} value={draft.env.ambient} onChange={(e) => setEnv({ ambient: +e.target.value })} aria-label="Ambient light" />
              </div>
              <div className="field-group two">
                <div>
                  <label>World size</label>
                  <div className="seg">
                    {(["small", "medium", "large"] as WorldSize[]).map((s) => <button key={s} className={draft.size === s ? "on" : ""} onClick={() => setDraft({ size: s })}>{SIZE_LABEL[s]}</button>)}
                  </div>
                </div>
                <div>
                  <label>Seed <span className="muted">optional</span></label>
                  <div className="seed-row">
                    <input className="field" inputMode="numeric" value={draft.seed} onChange={(e) => { const v = parseInt(e.target.value.replace(/\D/g, "") || "0", 10); setDraft({ seed: Math.min(99999999, v) }); }} aria-label="World seed" />
                    <button className="icon-btn glassy" onClick={() => setDraft({ seed: newSeed() })} aria-label="New seed" title="New seed"><Icon n="dice" /></button>
                  </div>
                </div>
              </div>
              <div className="panel-foot">
                <button className="btn primary big" onClick={enter} disabled={busy}><Icon n="sparkle" /> Enter {draft.name.trim() || "your universe"}</button>
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>
      <p className="preview-tag"><span className="live-dot" /> Live preview</p>
    </div>
  );
}
