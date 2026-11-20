import { motion } from "framer-motion";
import { useStore } from "../state/store";
import { Icon } from "./icons";

export function Welcome() {
  const startCreate = useStore((s) => s.startCreate), go = useStore((s) => s.go), worlds = useStore((s) => s.worlds), loaded = useStore((s) => s.loaded);
  const reduced = useStore((s) => s.reducedMotion);
  const d = (x: number) => (reduced ? 0 : x);
  return (
    <div className="screen welcome">
      <motion.div className="brand" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(0.2), duration: 1 }}>
        <span className="brand-dot" /> Pocket Universe
      </motion.div>
      <div className="welcome-copy">
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d(0.5), duration: 0.9 }}>
          A whole world, made by you.
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 16, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: d(0.8), duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}>
          Somewhere in the universe,<br /><em>a world is waiting for you.</em>
        </motion.h1>
        <motion.div className="welcome-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d(1.6), duration: 0.9 }}>
          <button className="btn primary big" onClick={startCreate}><Icon n="sparkle" /> Create a Universe</button>
          <button className="btn glassy big" onClick={() => go("collection")}>
            <Icon n="globe" /> Enter My Worlds {loaded && worlds.length > 0 && <span className="count">{worlds.length}</span>}
          </button>
        </motion.div>
      </div>
      <motion.p className="welcome-foot" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: d(2.4), duration: 1 }}>
        Your worlds are saved in this browser.
      </motion.p>
    </div>
  );
}
