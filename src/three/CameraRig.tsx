import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OC } from "three-stdlib";
import { FX } from "./mats";

export const controlsRef: { current: OC | null } = { current: null };

export const homeOf = (R: number, k = 1) => new THREE.Vector3(1, 0.78, 1.15).normalize().multiplyScalar((R * 2.35 + 4) * k);
const TARGET = new THREE.Vector3(0, 0.3, 0);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** shifts the rendered image sideways so the world sits beside a UI panel */
export function useViewShift(shift: number, shiftY = 0) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (shift || shiftY) cam.setViewOffset(size.width, size.height, -shift * size.width, shiftY * size.height, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    return () => { cam.clearViewOffset(); cam.updateProjectionMatrix(); };
  }, [camera, size.width, size.height, shift, shiftY]);
}

export function CameraRig({ R, introAt = 0, resetCam = 0, auto = false, autoSpeed = 0.35, interactive = true, shift = 0, shiftY = 0, dist = 1 }: {
  R: number; introAt?: number; resetCam?: number; auto?: boolean; autoSpeed?: number; interactive?: boolean; shift?: number; shiftY?: number; dist?: number;
}) {
  const { camera, size } = useThree();
  // portrait screens see less sideways, so pull the camera back
  const aspect = size.width / Math.max(1, size.height);
  dist = dist * (aspect < 1 ? Math.min(1.9, 0.82 / aspect) : 1);
  const ctl = useRef<OC>(null);
  const fly = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; tf: THREE.Vector3 } | null>(null);
  useViewShift(shift, shiftY);

  // first frame / world change: start at home
  useLayoutEffect(() => {
    camera.position.copy(homeOf(R, dist)); camera.lookAt(TARGET);
    if (ctl.current) { ctl.current.target.copy(TARGET); ctl.current.update(); }
  }, [R, dist]);

  // cinematic arrival: from far above, down through the clouds
  useEffect(() => {
    if (!introAt) return;
    const to = homeOf(R, dist);
    const from = to.clone().multiplyScalar(3.6).add(new THREE.Vector3(0, R * 3.2, 0));
    camera.position.copy(from);
    fly.current = { from, to, t0: introAt, dur: FX.reduced ? 600 : 2900, tf: TARGET.clone() };
  }, [introAt]);
  useEffect(() => {
    if (!resetCam) return;
    fly.current = { from: camera.position.clone(), to: homeOf(R, dist), t0: performance.now(), dur: 900, tf: ctl.current ? ctl.current.target.clone() : TARGET.clone() };
  }, [resetCam]);

  useEffect(() => { if (ctl.current && !fly.current) ctl.current.enabled = interactive; }, [interactive]);

  useFrame(() => {
    const f = fly.current, c = ctl.current;
    if (f) {
      const e = Math.min(1, Math.max(0, (performance.now() - f.t0) / f.dur)), k = ease(e);
      // a gentle arc rather than a straight line
      const p = f.from.clone().lerp(f.to, k);
      p.applyAxisAngle(new THREE.Vector3(0, 1, 0), (1 - k) * 0.9 * (f.dur > 1000 ? 1 : 0));
      camera.position.copy(p);
      const tgt = f.tf.clone().lerp(TARGET, k);
      camera.lookAt(tgt);
      if (c) { c.target.copy(tgt); c.enabled = false; }
      if (e >= 1) { fly.current = null; if (c) { c.enabled = interactive; c.update(); } }
    } else if (c) {
      // keep panning near the island
      if (c.target.length() > R * 0.8) c.target.setLength(R * 0.8);
      if (c.target.y < -1) c.target.y = -1; if (c.target.y > 3) c.target.y = 3;
    }
  });

  return (
    <OrbitControls
      ref={(r) => { (ctl as any).current = r; controlsRef.current = r as unknown as OC; }}
      makeDefault enableDamping dampingFactor={0.075} rotateSpeed={0.6} zoomSpeed={0.8} panSpeed={0.7}
      minDistance={Math.max(4, R * 0.55)} maxDistance={Math.max(R * 4.2, (R * 2.35 + 4) * dist * 1.35)} maxPolarAngle={1.62} minPolarAngle={0.12}
      autoRotate={auto && !FX.reduced} autoRotateSpeed={autoSpeed} target={TARGET} screenSpacePanning
    />
  );
}
