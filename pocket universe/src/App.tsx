import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useStore } from "./state/store";
import { Stage } from "./three/Stage";
import { Builder } from "./ui/Builder";
import { Collection } from "./ui/Collection";
import { Toasts } from "./ui/common";
import { Create } from "./ui/Create";
import { Welcome } from "./ui/Welcome";

export function App() {
  const screen = useStore((s) => s.screen), fading = useStore((s) => s.fading), load = useStore((s) => s.load), reduced = useStore((s) => s.reducedMotion);
  useEffect(() => { load(); }, []);
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", reduced); }, [reduced]);
  // save before the tab closes
  useEffect(() => {
    const h = () => { const s = useStore.getState(); if (s.current && s.save !== "saved") s.saveNow(); };
    window.addEventListener("pagehide", h);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") h(); });
    return () => window.removeEventListener("pagehide", h);
  }, []);
  return (
    <div className={"app scr-" + screen}>
      <Stage />
      <AnimatePresence mode="wait">
        <motion.div key={screen} className="layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {screen === "welcome" && <Welcome />}
          {screen === "collection" && <Collection />}
          {screen === "create" && <Create />}
          {screen === "builder" && <Builder />}
        </motion.div>
      </AnimatePresence>
      <div className={"veil" + (fading ? " on" : "")} aria-hidden="true" />
      <Toasts />
    </div>
  );
}
