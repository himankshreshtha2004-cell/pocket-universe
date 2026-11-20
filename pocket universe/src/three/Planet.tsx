import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { fbm, mulberry32 } from "../data/rng";
import { Cosmos } from "./Atmosphere";
import { FX, G, glowTexture, std, updateGlows } from "./mats";
import { Island } from "./Island";
import { grassLight, Motes } from "./Magic";
import { buildWorld, makeDraft } from "../state/store";
import type { ObjectKind } from "../data/types";
import { useViewShift } from "./CameraRig";

function planetGeometry() {
  const base = new THREE.IcosahedronGeometry(1, 5);
  const pos = base.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3(), c = new THREE.Color();
  const pal = { deep: "#3f8fc0", sea: "#6fd3d8", sand: "#f6e3b4", grass: "#7fc77c", grass2: "#5fae7a", rock: "#a9a7b6", snow: "#fff7ea", pink: "#f2b2d6" };
  const hs: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const h = fbm(v.x * 1.6 + 10, v.y * 1.6 + v.z * 1.3 + 10, 7, 5);
    hs.push(h);
    const r = h < 0.48 ? 0.985 : 1 + (h - 0.48) * 0.42;
    v.multiplyScalar(r); pos.setXYZ(i, v.x, v.y, v.z);
  }
  // colour per face (flat, faceted look)
  for (let f = 0; f < pos.count; f += 3) {
    const h = (hs[f] + hs[f + 1] + hs[f + 2]) / 3;
    const lat = Math.abs(new THREE.Vector3().fromBufferAttribute(pos, f).normalize().y);
    const k = h < 0.42 ? pal.deep : h < 0.48 ? pal.sea : h < 0.5 ? pal.sand : h < 0.56 ? pal.grass : h < 0.6 ? pal.grass2 : h < 0.64 ? pal.rock : pal.snow;
    c.set(lat > 0.88 && h >= 0.48 ? pal.snow : k).offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
    if (h >= 0.5 && h < 0.53 && Math.random() < 0.08) c.set(pal.pink);
    for (let j = 0; j < 3; j++) { col[(f + j) * 3] = c.r; col[(f + j) * 3 + 1] = c.g; col[(f + j) * 3 + 2] = c.b; }
  }
  base.setAttribute("color", new THREE.BufferAttribute(col, 3));
  base.computeVertexNormals();
  return { geo: base, hs };
}

const atmoMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { c1: { value: new THREE.Color("#87DCCF") }, c2: { value: new THREE.Color("#F2B2D6") } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 c1; uniform vec3 c2; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0., 1.), 2.2); vec3 c = mix(c1, c2, vN.y * .5 + .5); gl_FragColor = vec4(c * f * 1.6, f); }`,
});
const atmoMat2 = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: {},
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.), 3.0); gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * f * 1.4, f); }`,
});

function Ring() {
  const geo = useMemo(() => {
    const r = mulberry32(3), n = 520, a = new Float32Array(n * 3), c = new Float32Array(n * 3);
    const tints = ["#F2B2D6", "#87DCCF", "#FFF7EA", "#A9C9F5", "#F6C6A6"].map((h) => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      const t = r() * Math.PI * 2, d = 1.75 + Math.pow(r(), 2) * 0.7;
      a[i * 3] = Math.cos(t) * d; a[i * 3 + 1] = (r() - 0.5) * 0.06; a[i * 3 + 2] = Math.sin(t) * d;
      const k = tints[Math.floor(r() * tints.length)]; c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); g.setAttribute("color", new THREE.BufferAttribute(c, 3)); return g;
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), vertexColors: true, size: 0.07, transparent: true, opacity: 0.6, depthWrite: false }), []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => { if (ref.current && !FX.reduced) ref.current.rotation.y += dt * 0.06; });
  return <points ref={ref} geometry={geo} material={mat} />;
}

const bubbleMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){
      float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.6);
      float band = sin(f * 5.0 + vP.y * 2.0) * 0.5 + 0.5;
      vec3 irid = mix(vec3(0.53, 0.86, 0.81), vec3(0.95, 0.70, 0.84), band);
      irid = mix(irid, vec3(0.66, 0.79, 0.96), smoothstep(0.3, 1.0, vP.x * 0.5 + 0.5) * 0.5);
      gl_FragColor = vec4(irid * (f * 0.8 + 0.02), f * 0.7 + 0.02); }`,
});
const bubbleBack = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.75, 0.72, 1.0) * f * 0.5, f * 0.4); }`,
});

function heroWorld() {
  const d = makeDraft("forest"); d.seed = 1204; d.size = "small"; d.name = "hero"; d.env.time = "sunset";
  const w = buildWorld(d);
  const extra: [ObjectKind, number, number, number][] = [["magictree", 0.1, -0.2, 0], ["lantern", -1.2, 1.4, 1.5], ["lantern", 1.6, -0.6, 1.8], ["lantern", 0.4, 2.0, 1.3], ["stars", -0.6, -1.4, 1.4]];
  for (const [kind, x, z, lift] of extra) w.objects.push({ id: "hero-" + kind + x, kind, p: [x, lift, z], r: 0, s: 1.2, v: 3 });
  return w;
}

export function PlanetScene({ shift = 0, dim = false }: { shift?: number; dim?: boolean }) {
  const world = useMemo(heroWorld, []);
  const R = world.terrain.radius;
  const spin = useRef<THREE.Group>(null), tilt = useRef<THREE.Group>(null), moon = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useViewShift(shift);
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: "#8177C9", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const halo2 = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: "#F6C6A6", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const shine = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useFrame((state, dt) => {
    FX.time = state.clock.elapsedTime; FX.night = 0.55;
    updateGlows(0.55, FX.time);
    grassLight.time.value = FX.reduced ? 0 : FX.time;
    grassLight.sun.value.set(0.9, 0.62, 0.45); grassLight.amb.value.set(0.42, 0.38, 0.55);
    bubbleMat.uniforms.uTime.value = FX.time;
    if (spin.current && !FX.reduced) spin.current.rotation.y += dt * 0.09;
    if (tilt.current) {
      tilt.current.rotation.x += ((FX.reduced ? 0 : -pointer.y * 0.1) + 0.12 - tilt.current.rotation.x) * Math.min(1, dt * 2);
      tilt.current.rotation.z += ((FX.reduced ? 0 : pointer.x * 0.08) - 0.06 - tilt.current.rotation.z) * Math.min(1, dt * 2);
      tilt.current.position.y = FX.reduced ? 0 : Math.sin(FX.time * 0.6) * 0.05;
    }
    if (moon.current && !FX.reduced) { const t = FX.time * 0.15; moon.current.position.set(Math.cos(t) * 2.9, Math.sin(t * 0.7) * 0.6 + 0.4, Math.sin(t) * 2.9); }
  });
  return (
    <group>
      <color attach="background" args={["#111329"]} />
      <Cosmos opacity={dim ? 0.7 : 1} />
      <hemisphereLight args={["#d9d3ff", "#4a3a62", 1.15]} />
      <directionalLight position={[-3, 4, 4]} intensity={2.4} color="#ffe2c4" />
      <directionalLight position={[3, 1, -4]} intensity={1.1} color="#a9c9f5" />
      <pointLight position={[2.5, -0.5, 2]} intensity={10} color="#f2b2d6" distance={8} />
      <sprite material={halo} scale={[6, 6, 6]} position={[0, 0, -1.6]} />
      <sprite material={halo2} scale={[3.2, 3.2, 3.2]} position={[0, -0.3, -1]} />
      <group ref={tilt}>
        <group ref={spin} position={[0, 0.05, 0]}>
          <group scale={1.3 / R} position={[0, 0.05, 0]}><Island world={world} thumb /></group>
        </group>
        <mesh geometry={G.ball} material={bubbleBack} scale={1.5} position={[0, -0.12, 0]} />
        <mesh geometry={G.ball} material={bubbleMat} scale={1.5} position={[0, -0.12, 0]} />
        <sprite material={shine} position={[-0.62, 0.62, 1.2]} scale={[0.5, 0.22, 1]} rotation={[0, 0, 0.7]} />
        <Ring />
      </group>
    </group>
  );
}
