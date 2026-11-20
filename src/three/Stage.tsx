import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { prefs } from "../data/db";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildWorld, captureRef, useStore } from "../state/store";
import { canPlace, heightAt } from "../data/terrain";
import { Atmosphere } from "./Atmosphere";
import { CameraRig } from "./CameraRig";
import { Editor } from "./Editor";
import { Island, SelectionRing } from "./Island";
import { FX } from "./mats";
import { PlanetScene } from "./Planet";
import { ThumbFactory } from "./Thumbs";
import { Effects } from "./Effects";

/** lets the UI grab an image of what the camera currently sees */
function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.fn = (w, h, type = "image/jpeg") => {
      try {
        // the canvas keeps its last frame (with all effects), so read it as it is
        const src = gl.domElement;
        if (!w || !h) return src.toDataURL(type, 0.92);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d")!;
        const sr = src.width / src.height, tr = w / h;
        let sw = src.width, sh = src.height, sx = 0, sy = 0;
        if (sr > tr) { sw = sh * tr; sx = (src.width - sw) / 2; } else { sh = sw / tr; sy = (src.height - sh) / 2; }
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
        return c.toDataURL(type, 0.82);
      } catch { return null; }
    };
    // test hook (only with ?test in the URL): lets automated tests find screen positions of world points
    if (location.search.includes("test")) {
      (window as any).__pocket = {
        store: useStore,
        project: (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(camera); const r = gl.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
        canPlace, heightAt, capture: (w: number, h: number) => captureRef.fn?.(w, h, "image/jpeg"),
      };
    }
    return () => { captureRef.fn = null; };
  }, [gl, scene, camera]);
  return null;
}

function WelcomeCam({ z = 6.4, y = 0 }: { z?: number; y?: number }) {
  const { camera, size } = useThree();
  const portrait = size.width < size.height;
  if (portrait) { z *= 1.75; y *= 2.1; }
  useEffect(() => { camera.position.set(0, y, z); camera.lookAt(0, y, 0); (camera as THREE.PerspectiveCamera).fov = 40; camera.updateProjectionMatrix(); }, [camera, z, y]);
  return null;
}

function PreviewWorld() {
  const draft = useStore((s) => s.draft), step = useStore((s) => s.createStep);
  // terrain depends on biome / size / seed; atmosphere updates live without rebuilding
  const world = useMemo(() => buildWorld({ ...draft, name: draft.name || "preview" }), [draft.biome, draft.size, draft.seed]);
  const R = world.terrain.radius;
  const wide = typeof window !== "undefined" && window.innerWidth > 900;
  return (
    <>
      <Atmosphere env={draft.env} biome={draft.biome} R={R} />
      <group key={world.id}><Island world={world} /></group>
      <CameraRig R={R} auto autoSpeed={0.5} dist={wide ? 1.12 : 1.15} shift={wide ? 0.2 : 0} shiftY={wide ? 0 : 0.24} />
    </>
  );
}

function BuilderWorld() {
  const world = useStore((s) => s.current);
  const selectedId = useStore((s) => s.selectedId), hoverId = useStore((s) => s.hoverId), justPlaced = useStore((s) => s.justPlaced);
  const introAt = useStore((s) => s.introAt), resetCam = useStore((s) => s.resetCam), cinematic = useStore((s) => s.cinematic);
  if (!world) return null;
  const R = world.terrain.radius;
  return (
    <>
      <Atmosphere env={world.env} biome={world.biome} R={R} />
      <Island world={world} editable selectedId={selectedId} hoverId={hoverId} justPlaced={justPlaced} />
      {!cinematic && <SelectionRing world={world} id={selectedId} />}
      <Editor world={world} />
      <CameraRig key={world.id} R={R} introAt={introAt} resetCam={resetCam} auto={cinematic} autoSpeed={0.45} shiftY={cinematic ? 0 : 0.08} />
    </>
  );
}

/** the post-processing composer switches the renderer's auto-clear off and never restores it;
 *  without effects that leaves old frames on screen (smears, white blow-outs), so keep it on */
function ClearGuard({ effects }: { effects: boolean }) {
  const { gl } = useThree();
  useEffect(() => { if (!effects) gl.autoClear = true; }, [effects, gl]);
  useFrame(() => { if (!effects && !gl.autoClear) gl.autoClear = true; });
  return null;
}

/** if the device can't keep up, switch to lighter graphics once (and say so) */
function PerfGuard() {
  const acc = useMemo(() => ({ t0: 0, frames: 0, done: location.search.includes("test") || prefs.get("perfChecked", false) }), []);
  useFrame(() => {
    if (acc.done) return;
    const now = performance.now();
    if (!acc.t0) { acc.t0 = now + 4000; return; }
    if (now < acc.t0) return;
    acc.frames++;
    if (now - acc.t0 > 3000) {
      acc.done = true; prefs.set("perfChecked", true);
      const fps = (acc.frames * 1000) / (now - acc.t0);
      const s = useStore.getState();
      if (fps < 24 && s.quality === "high") { s.setPrefs({ quality: "low" }); s.toast("Lighter graphics", "Switched to a lighter look so things move smoothly. You can change it in world settings."); }
    }
  });
  return null;
}

export function Stage() {
  const screen = useStore((s) => s.screen), quality = useStore((s) => s.quality), reduced = useStore((s) => s.reducedMotion);
  useEffect(() => { FX.reduced = reduced; }, [reduced]);
  const wide = typeof window !== "undefined" && window.innerWidth > 900;
  const effectsOn = quality === "high" && !reduced && (screen === "builder" || screen === "create");
  return (
    <Canvas
      className="stage"
      shadows={quality === "high" ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={quality === "high" ? [1, 1.75] : [1, 1]}
      flat
      gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ fov: 38, near: 0.1, far: 400, position: [12, 9, 14] }}
    >
      <Suspense fallback={null}>
        {(screen === "welcome" || screen === "collection") && <>
          <WelcomeCam z={screen === "collection" ? 8.5 : 7.0} y={screen === "collection" ? 0 : -0.95} />
          <PlanetScene shift={screen === "collection" ? 0 : 0} dim={screen === "collection"} />
        </>}
        {screen === "create" && <PreviewWorld />}
        {screen === "builder" && <BuilderWorld />}
        <ThumbFactory />
        <Capture />
        <PerfGuard />
        <ClearGuard effects={effectsOn} />
        {effectsOn && <Effects />}
      </Suspense>
    </Canvas>
  );
}
