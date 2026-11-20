import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BIOMES } from "../data/biomes";
import { ITEMS } from "../data/catalog";
import { canPlace, groundY, heightAt, insideIsland } from "../data/terrain";
import type { World } from "../data/types";
import { BRUSH_R, useStore, type Burst } from "../state/store";
import { Model } from "./assets";
import { controlsRef } from "./CameraRig";
import { registry } from "./Island";
import { G, glowTexture } from "./mats";

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** all pointer interaction with the world: placing, selecting, dragging, sculpting and painting */
export function Editor({ world }: { world: World }) {
  const { gl, camera } = useThree();
  const mode = useStore((s) => s.mode), placeKind = useStore((s) => s.placeKind), ghostRot = useStore((s) => s.ghostRot);
  const brush = useStore((s) => s.brush), terrainTool = useStore((s) => s.terrainTool), cinematic = useStore((s) => s.cinematic);
  const ghost = useRef<THREE.Group>(null), cursor = useRef<THREE.Mesh>(null);
  const [ghostOk, setGhostOk] = useState(true);
  const [ghostVis, setGhostVis] = useState(false);
  const [cursorVis, setCursorVis] = useState(false);
  const st = useRef({ mode: "none" as "none" | "stroke" | "drag" | "click", x0: 0, y0: 0, t0: 0, downId: null as string | null, off: [0, 0], pointers: new Set<number>(), queued: null as null | [number, number], dragTo: null as null | [number, number] });
  const worldRef = useRef(world); worldRef.current = world;

  useEffect(() => {
    const el = gl.domElement;
    const setRay = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const hitTerrain = () => { const m = registry.terrain; if (!m) return null; const h = ray.intersectObject(m, false)[0]; return h ? h.point : null; };
    const hitObject = () => {
      const hits = ray.intersectObjects(Array.from(registry.objects.values()), true);
      for (const h of hits) {
        if (!(h.object as THREE.Mesh).isMesh) continue;
        let o: THREE.Object3D | null = h.object;
        while (o && !o.userData.pid) o = o.parent;
        if (o) return o.userData.pid as string;
      }
      return null;
    };
    const ctl = () => controlsRef.current;

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const S = st.current; S.pointers.add(e.pointerId);
      const s = useStore.getState();
      if (S.pointers.size > 1) { if (S.mode === "stroke" || S.mode === "drag") { s.end(); } S.mode = "none"; const c = ctl(); if (c) c.enabled = true; return; }
      if (s.cinematic || s.settingsOpen || !s.current) return;
      setRay(e);
      S.x0 = e.clientX; S.y0 = e.clientY; S.t0 = performance.now();
      const pt = hitTerrain();
      if (s.mode === "terrain" && pt) {
        const c = ctl(); if (c) c.enabled = false;
        s.begin(); S.mode = "stroke"; S.queued = [pt.x, pt.z];
        el.setPointerCapture(e.pointerId);
        return;
      }
      const id = s.mode === "place" ? null : hitObject();
      if (s.mode === "explore" && id && id === s.selectedId) {
        const o = s.current.objects.find((x) => x.id === id);
        if (o) {
          const c = ctl(); if (c) c.enabled = false;
          s.begin(); S.mode = "drag"; S.off = pt ? [o.p[0] - pt.x, o.p[2] - pt.z] : [0, 0];
          el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing";
          return;
        }
      }
      S.mode = "click"; S.downId = id;
    };
    const move = (e: PointerEvent) => {
      const S = st.current, s = useStore.getState();
      if (s.cinematic || !s.current) return;
      setRay(e);
      if (S.mode === "stroke") { const p = hitTerrain(); if (p) S.queued = [p.x, p.z]; updateCursor(p); return; }
      if (S.mode === "drag") { const p = hitTerrain(); if (p) S.dragTo = [p.x + S.off[0], p.z + S.off[1]]; return; }
      if (S.mode === "click" && Math.hypot(e.clientX - S.x0, e.clientY - S.y0) > 6) S.mode = "none";
      if (e.buttons && S.mode === "none") return; // orbiting
      if (s.mode === "place") {
        const p = hitTerrain();
        const g = ghost.current;
        if (p && g && s.placeKind) {
          g.position.set(p.x, groundY(s.current.terrain, s.placeKind, p.x, p.z) + (ITEMS[s.placeKind].lift ?? 0), p.z);
          setGhostVis(true); setGhostOk(canPlace(s.current.terrain, s.placeKind, p.x, p.z));
        } else setGhostVis(false);
        el.style.cursor = p ? "crosshair" : "";
      } else if (s.mode === "terrain") {
        const p = hitTerrain(); updateCursor(p); el.style.cursor = p ? "none" : "";
      } else {
        const id = hitObject(); s.hover(id);
        el.style.cursor = id ? (id === s.selectedId ? "grab" : "pointer") : "";
      }
    };
    const up = (e: PointerEvent) => {
      const S = st.current, s = useStore.getState();
      S.pointers.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
      if (S.mode === "stroke" || S.mode === "drag") {
        if (S.queued && S.mode === "stroke") { s.stroke(S.queued[0], S.queued[1]); S.queued = null; }
        if (S.dragTo && S.mode === "drag") { applyDrag(S.dragTo); S.dragTo = null; }
        s.end(); const c = ctl(); if (c) c.enabled = true;
        el.style.cursor = S.mode === "drag" ? "grab" : el.style.cursor;
        S.mode = "none"; return;
      }
      if (S.mode === "click" && performance.now() - S.t0 < 1200 && s.current) {
        setRay(e);
        if (s.mode === "place" && s.placeKind) {
          const p = hitTerrain();
          if (p && canPlace(s.current.terrain, s.placeKind, p.x, p.z)) s.placeAt(s.placeKind, p.x, p.z);
        } else if (s.mode === "explore") s.select(S.downId);
      }
      S.mode = "none";
    };
    const leave = () => { setGhostVis(false); setCursorVis(false); useStore.getState().hover(null); };
    const updateCursor = (p: THREE.Vector3 | null) => {
      const c = cursor.current; const s = useStore.getState();
      if (!c || !p || !s.current) { setCursorVis(false); return; }
      c.position.set(p.x, heightAt(s.current.terrain, p.x, p.z) + 0.06, p.z);
      setCursorVis(true);
    };
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerdown", down, true); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("pointerleave", leave);
      el.style.cursor = "";
    };
  }, [gl, camera]);

  function applyDrag([x, z]: [number, number]) {
    const s = useStore.getState(); const id = s.selectedId; if (!id || !s.current) return;
    const t = s.current.terrain;
    if (!insideIsland(t, x, z, 0.3)) return;
    s.live((w) => ({ ...w, objects: w.objects.map((o) => (o.id === id ? { ...o, p: [x, o.p[1], z] } : o)) }));
  }

  // apply at most one brush step / drag step per frame
  useFrame(() => {
    const S = st.current, s = useStore.getState();
    if (S.mode === "stroke" && S.queued) { s.stroke(S.queued[0], S.queued[1]); S.queued = null; }
    if (S.mode === "drag" && S.dragTo) { applyDrag(S.dragTo); S.dragTo = null; }
  });

  useEffect(() => { if (mode !== "place") setGhostVis(false); if (mode !== "terrain") setCursorVis(false); }, [mode]);

  const biome = BIOMES[world.biome];
  const brushR = BRUSH_R[brush];
  const toolColor = terrainTool === "raise" ? "#f6c6a6" : terrainTool === "lower" ? "#a9c9f5" : terrainTool === "smooth" ? "#fff7ea" : "#f2b2d6";
  return (
    <group visible={!cinematic}>
      {mode === "place" && placeKind && (
        <group ref={ghost} visible={ghostVis} rotation={[0, ghostRot, 0]}>
          <Model key={placeKind + ghostOk} kind={placeKind} biome={biome} v={7} ghost={ghostOk ? "ok" : "bad"} />
          <mesh geometry={G.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={ITEMS[placeKind].r + 0.1} renderOrder={5}>
            <meshBasicMaterial color={ghostOk ? "#87dccf" : "#f28f9b"} transparent opacity={0.85} depthWrite={false} />
          </mesh>
        </group>
      )}
      <mesh ref={cursor} geometry={G.ring} rotation={[-Math.PI / 2, 0, 0]} scale={brushR} visible={mode === "terrain" && cursorVis} renderOrder={6}>
        <meshBasicMaterial color={toolColor} transparent opacity={0.9} depthWrite={false} depthTest={false} />
      </mesh>
      <Bursts world={world} />
    </group>
  );
}

/* ------------------------------------------------------------------ feedback effects */
function Bursts({ world }: { world: World }) {
  const bursts = useStore((s) => s.bursts);
  return <>{bursts.map((b) => <BurstFX key={b.id} b={b} world={world} />)}</>;
}
function BurstFX({ b, world }: { b: Burst; world: World }) {
  const ring = useRef<THREE.Mesh>(null), pts = useRef<THREE.Points>(null);
  const y = heightAt(world.terrain, b.x, b.z) + 0.06;
  const color = b.kind === "remove" ? "#f2b2d6" : b.kind === "discover" ? "#ffd58a" : "#87dccf";
  const { geo, vel } = useMemo(() => {
    const n = b.kind === "discover" ? 40 : 18, a = new Float32Array(n * 3), v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const t = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.2; v[i * 3] = Math.cos(t) * s; v[i * 3 + 1] = 1.2 + Math.random() * (b.kind === "discover" ? 3 : 1.6); v[i * 3 + 2] = Math.sin(t) * s; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); return { geo: g, vel: v };
  }, []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }), []);
  const ptMat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), color, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useFrame(() => {
    const e = Math.min(1, (performance.now() - b.t) / 1100);
    if (ring.current) { ring.current.scale.setScalar((b.r + 0.2) * (0.6 + e * 1.6)); ringMat.opacity = (1 - e) * 0.8; }
    const a = geo.attributes.position.array as Float32Array, tt = e * 1.1;
    for (let i = 0; i < a.length; i += 3) { a[i] = vel[i] * tt * 0.7; a[i + 1] = vel[i + 1] * tt - 2.2 * tt * tt * 0.6; a[i + 2] = vel[i + 2] * tt * 0.7; }
    geo.attributes.position.needsUpdate = true; ptMat.opacity = 1 - e;
  });
  return (
    <group position={[b.x, y, b.z]}>
      <mesh ref={ring} geometry={G.ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} />
      <points ref={pts} geometry={geo} material={ptMat} />
    </group>
  );
}
