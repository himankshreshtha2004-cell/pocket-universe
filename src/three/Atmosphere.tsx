import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, LIGHTS, type Light } from "../data/biomes";
import { mulberry32 } from "../data/rng";
import type { BiomeId, Env } from "../data/types";
import { FX, G, glowTexture, std, updateGlows } from "./mats";
import { grassLight } from "./Magic";

/* ------------------------------------------------------------------ sky dome */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 horizon; uniform vec2 res; varying vec3 vP;
    void main(){
      float s = gl_FragCoord.y / res.y;              // 0 bottom .. 1 top of the screen
      float h = clamp(s * 1.05 + vP.y * 0.35 - 0.12, 0., 1.);
      vec3 c = h > .42 ? mix(horizon, top, smoothstep(.42, 1., h)) : mix(bottom, horizon, smoothstep(0., .42, h));
      gl_FragColor = vec4(c, 1.); }`,
});

/** cosmic backdrop: stars + soft nebula clouds (also used on the welcome screen) */
export function Cosmos({ starsRef, opacity = 1 }: { starsRef?: React.MutableRefObject<number>; opacity?: number }) {
  const stars = useMemo(() => {
    const r = mulberry32(42), n = 1400, a = new Float32Array(n * 3), c = new Float32Array(n * 3);
    const tints = ["#ffffff", "#fff7ea", "#a9c9f5", "#f2b2d6", "#87dccf"].map((h) => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = 90 + r() * 20;
      a[i * 3] = s * Math.cos(th) * d; a[i * 3 + 1] = u * d; a[i * 3 + 2] = s * Math.sin(th) * d;
      const t = tints[Math.floor(r() * tints.length)]; c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 1.6, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }), []);
  const nebula = useMemo(() => {
    const r = mulberry32(7);
    return Array.from({ length: 7 }, (_, i) => ({ p: [Math.cos(i * 0.9) * 70, (r() - 0.3) * 50, Math.sin(i * 0.9) * 70] as [number, number, number], s: 45 + r() * 40, c: ["#8177C9", "#F2B2D6", "#87DCCF", "#A9C9F5", "#8177C9", "#F6C6A6", "#242044"][i] }));
  }, []);
  const nebMats = useMemo(() => nebula.map((n) => new THREE.SpriteMaterial({ map: glowTexture(), color: n.c, transparent: true, depthWrite: false, opacity: 0.16, fog: false, blending: THREE.AdditiveBlending })), [nebula]);
  const grp = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const k = (starsRef ? starsRef.current : 1) * opacity;
    mat.opacity = k * 0.75;
    nebMats.forEach((m) => (m.opacity = 0.14 * k));
    if (grp.current && !FX.reduced) grp.current.rotation.y += dt * 0.004;
  });
  return (
    <group ref={grp}>
      <points geometry={stars} material={mat} />
      {nebula.map((n, i) => <sprite key={i} material={nebMats[i]} position={n.p} scale={[n.s, n.s, n.s]} />)}
    </group>
  );
}

/* ------------------------------------------------------------------ clouds */
const tmpV = new THREE.Vector3();
function Cloud({ seed, color, scale = 1 }: { seed: number; color: THREE.Color; scale?: number }) {
  const parts = useMemo(() => { const r = mulberry32(seed); return Array.from({ length: 4 + Math.floor(r() * 3) }, (_, i) => ({ x: (i - 2) * 0.55 + r() * 0.3, y: r() * 0.25, z: (r() - 0.5) * 0.5, s: 0.45 + r() * 0.4 })); }, [seed]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.95, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12 }), []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    mat.color.copy(color);
    if (!ref.current) return;
    // fade clouds that drift close to the camera so they never block the view
    const d = ref.current.getWorldPosition(tmpV).distanceTo(camera.position);
    const k = Math.min(1, Math.max(0, (d - 4 * scale) / (6 * scale)));
    mat.opacity = 0.95 * k; ref.current.visible = k > 0.02; mat.emissiveIntensity = 0.12 - FX.night * 0.1;
  });
  return <group ref={ref} scale={scale}>{parts.map((p, i) => <mesh key={i} geometry={G.puff} material={mat} position={[p.x, p.y, p.z]} scale={[p.s * 1.3, p.s, p.s]} />)}</group>;
}
function Clouds({ R, color, below }: { R: number; color: THREE.Color; below: boolean }) {
  const list = useMemo(() => { const r = mulberry32(9); return Array.from({ length: 10 }, (_, i) => i < 6
    ? { a: (i / 6) * Math.PI * 2 + r(), d: R * (1.15 + r() * 0.3), y: 1.8 + r() * 2.2, s: 0.42 + r() * 0.4, sp: 0.015 + r() * 0.02 }
    : { a: (i / 4) * Math.PI * 2 + r(), d: R * (3.6 + r() * 1.2), y: -3 + r() * 9, s: 1.6 + r() * 1.4, sp: 0.006 + r() * 0.008 }); }, [R]);
  const sea = useMemo(() => { const r = mulberry32(19); return Array.from({ length: below ? 22 : 0 }, (_, i) => ({ a: r() * Math.PI * 2, d: R * (0.3 + r() * 1.9), y: -R * 0.6 - 2.5 - r() * 2, s: 1.4 + r() * 1.6 })); }, [R, below]);
  const grp = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (!grp.current || FX.reduced) return; grp.current.children.forEach((c, i) => { const it = list[i]; if (!it) return; it.a += dt * it.sp; c.position.set(Math.cos(it.a) * it.d, it.y, Math.sin(it.a) * it.d); c.rotation.y = -it.a; }); });
  return (
    <group>
      <group ref={grp}>{list.map((c, i) => <group key={i} position={[Math.cos(c.a) * c.d, c.y, Math.sin(c.a) * c.d]}><Cloud seed={i + 3} color={color} scale={c.s} /></group>)}</group>
      {sea.map((c, i) => <group key={"s" + i} position={[Math.cos(c.a) * c.d, c.y, Math.sin(c.a) * c.d]}><Cloud seed={i + 40} color={color} scale={c.s} /></group>)}
    </group>
  );
}

/* ------------------------------------------------------------------ weather */
function Rain({ R, on }: { R: number; on: boolean }) {
  const n = 700, H = 11;
  const { geo, data } = useMemo(() => {
    const r = mulberry32(3), a = new Float32Array(n * 6), d = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const t = r() * Math.PI * 2, s = Math.sqrt(r()) * R * 1.05; d[i * 3] = Math.cos(t) * s; d[i * 3 + 1] = r() * H; d[i * 3 + 2] = Math.sin(t) * s; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); return { geo: g, data: d };
  }, [R]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: "#cfe2ff", transparent: true, opacity: 0, depthWrite: false }), []);
  useFrame((_, dt) => {
    mat.opacity += ((on ? 0.45 : 0) - mat.opacity) * Math.min(1, dt * 2);
    if (mat.opacity < 0.01) return;
    const a = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < n; i++) {
      data[i * 3 + 1] -= dt * (FX.reduced ? 4 : 11); if (data[i * 3 + 1] < -0.5) data[i * 3 + 1] = H;
      const x = data[i * 3], y = data[i * 3 + 1], z = data[i * 3 + 2];
      a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x + 0.03; a[i * 6 + 4] = y + 0.32; a[i * 6 + 5] = z;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
}
function Snow({ R, on }: { R: number; on: boolean }) {
  const n = 800, H = 11;
  const { geo, seeds } = useMemo(() => {
    const r = mulberry32(5), a = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 1.05; a[i * 3] = Math.cos(t) * d; a[i * 3 + 1] = r() * H; a[i * 3 + 2] = Math.sin(t) * d; s[i] = r() * 6; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); return { geo: g, seeds: s };
  }, [R]);
  const mat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), color: "#ffffff", size: 0.16, transparent: true, opacity: 0, depthWrite: false }), []);
  useFrame((_, dt) => {
    mat.opacity += ((on ? 0.95 : 0) - mat.opacity) * Math.min(1, dt * 2);
    if (mat.opacity < 0.01) return;
    const a = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < n; i++) {
      a[i * 3 + 1] -= dt * (FX.reduced ? 0.4 : 0.8); if (a[i * 3 + 1] < -0.3) a[i * 3 + 1] = H;
      if (!FX.reduced) a[i * 3] += Math.sin(FX.time + seeds[i]) * dt * 0.25;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ ambient life */
function Fireflies({ R, on }: { R: number; on: boolean }) {
  const n = 70;
  const { geo, base } = useMemo(() => {
    const r = mulberry32(11), a = new Float32Array(n * 3), b = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const t = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.85; b[i * 4] = Math.cos(t) * d; b[i * 4 + 1] = 0.6 + r() * 1.8; b[i * 4 + 2] = Math.sin(t) * d; b[i * 4 + 3] = r() * 10; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); return { geo: g, base: b };
  }, [R]);
  const mat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), color: "#e9ffb0", size: 0.3, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useFrame(() => {
    mat.opacity = on ? Math.max(0, FX.night - 0.2) * 1.1 : 0;
    if (mat.opacity < 0.01) return;
    const a = geo.attributes.position.array as Float32Array, t = FX.time * (FX.reduced ? 0.2 : 1);
    for (let i = 0; i < n; i++) { const s = base[i * 4 + 3]; a[i * 3] = base[i * 4] + Math.sin(t * 0.5 + s) * 0.6; a[i * 3 + 1] = base[i * 4 + 1] + Math.sin(t * 0.8 + s * 2) * 0.3; a[i * 3 + 2] = base[i * 4 + 2] + Math.cos(t * 0.4 + s) * 0.6; }
    geo.attributes.position.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
function Butterflies({ R, on }: { R: number; on: boolean }) {
  const list = useMemo(() => { const r = mulberry32(21); return Array.from({ length: 6 }, () => ({ cx: (r() - 0.5) * R, cz: (r() - 0.5) * R, rr: 0.8 + r() * 1.5, y: 0.7 + r() * 0.8, sp: 0.4 + r() * 0.4, ph: r() * 6, c: ["#F2B2D6", "#FFF7EA", "#A9C9F5", "#F6C6A6"][Math.floor(r() * 4)] })); }, [R]);
  const grp = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = grp.current; if (!g) return;
    g.visible = on && FX.night < 0.6;
    if (!g.visible) return;
    g.children.forEach((c, i) => {
      const b = list[i], t = FX.time * b.sp + b.ph;
      c.position.set(b.cx + Math.cos(t) * b.rr, b.y + Math.sin(t * 2.3) * 0.2, b.cz + Math.sin(t * 1.3) * b.rr);
      c.rotation.y = -t + Math.PI / 2;
      const f = FX.reduced ? 0.4 : Math.sin(FX.time * 18 + b.ph) * 0.9;
      (c.children[0] as THREE.Object3D).rotation.z = f; (c.children[1] as THREE.Object3D).rotation.z = -f;
    });
  });
  return (
    <group ref={grp}>
      {list.map((b, i) => (
        <group key={i}>
          <group><mesh geometry={G.plane} material={std(b.c, { side: THREE.DoubleSide })} position={[0.05, 0, 0]} scale={[0.1, 0.07, 1]} rotation={[-Math.PI / 2, 0, 0]} /></group>
          <group><mesh geometry={G.plane} material={std(b.c, { side: THREE.DoubleSide })} position={[-0.05, 0, 0]} scale={[0.1, 0.07, 1]} rotation={[-Math.PI / 2, 0, 0]} /></group>
        </group>
      ))}
    </group>
  );
}
function Birds({ R, on }: { R: number; on: boolean }) {
  const list = useMemo(() => { const r = mulberry32(31); return Array.from({ length: 5 }, (_, i) => ({ d: R * (0.35 + r() * 0.5), y: 6.5 + r() * 2, sp: 0.12 + r() * 0.08, ph: i * 0.35 + r() * 0.2 })); }, [R]);
  const grp = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = grp.current; if (!g) return;
    g.visible = on && FX.night < 0.5;
    if (!g.visible) return;
    g.children.forEach((c, i) => {
      const b = list[i], t = FX.time * b.sp + b.ph;
      c.position.set(Math.cos(t) * b.d, b.y + Math.sin(t * 3) * 0.2, Math.sin(t) * b.d);
      c.rotation.y = -t;
      const f = FX.reduced ? 0.2 : Math.sin(FX.time * 7 + i) * 0.5;
      (c.children[0] as THREE.Object3D).rotation.x = f; (c.children[1] as THREE.Object3D).rotation.x = -f;
    });
  });
  return (
    <group ref={grp}>
      {list.map((_, i) => (
        <group key={i}>
          <group><mesh geometry={G.box} material={std("#3b3470")} position={[0, 0, 0.13]} scale={[0.07, 0.015, 0.26]} rotation={[0.3, 0, 0]} /></group>
          <group><mesh geometry={G.box} material={std("#3b3470")} position={[0, 0, -0.13]} scale={[0.07, 0.015, 0.26]} rotation={[-0.3, 0, 0]} /></group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ lighting director */
const C = () => new THREE.Color();

export function Atmosphere({ env, biome, R, life = true }: { env: Env; biome: BiomeId; R: number; life?: boolean }) {
  const { scene } = useThree();
  const B = BIOMES[biome];
  const cur = useRef({ top: C(), bottom: C(), horizon: C(), sun: C(), hemiSky: C(), hemiGround: C(), fog: C(), cloud: C(), sunI: 2, hemiI: 1, stars: 0, night: 0, sunPos: new THREE.Vector3(6, 16, 7), init: false });
  const rim = useRef<THREE.DirectionalLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null), hemi = useRef<THREE.HemisphereLight>(null), moon = useRef<THREE.Sprite>(null);
  const starK = useRef(0);
  const sunMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: "#fff1df", transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), []);
  const cloudColor = useMemo(() => new THREE.Color(), []);
  const fog = useMemo(() => new THREE.Fog("#000000", 40, 140), []);
  useMemo(() => { scene.fog = fog; }, [scene, fog]);

  useFrame((state, dt) => {
    FX.time = state.clock.elapsedTime;
    const L = LIGHTS[env.time], c = cur.current;
    const rain = env.weather === "rain";
    const tint = env.sky ? new THREE.Color(env.sky) : null;
    const tgt = {
      top: new THREE.Color(L.skyTop), bottom: new THREE.Color(L.skyBottom), horizon: new THREE.Color(L.horizon),
      sun: new THREE.Color(L.sun), hemiSky: new THREE.Color(L.hemiSky), hemiGround: new THREE.Color(L.hemiGround), fog: new THREE.Color(L.fog),
      cloud: new THREE.Color(B.palette.cloud).lerp(new THREE.Color(L.horizon), 0.25),
    };
    if (biome === "desert" && env.time !== "afternoon") { tgt.top.lerp(new THREE.Color("#2a2060"), 0.25); }
    if (tint) { tgt.top.lerp(tint, 0.38); tgt.horizon.lerp(tint, 0.3); tgt.bottom.lerp(tint, 0.3); tgt.fog.lerp(tint, 0.25); }
    if (rain) { const grey = new THREE.Color("#8e94a8"); tgt.top.lerp(grey, 0.5); tgt.horizon.lerp(grey, 0.45); tgt.bottom.lerp(grey, 0.4); tgt.fog.lerp(grey, 0.4); tgt.cloud.lerp(new THREE.Color("#9aa0b5"), 0.6); }
    if (env.time === "night") tgt.cloud.lerp(new THREE.Color("#4b4a80"), 0.65);
    const stars = Math.max(L.stars, biome === "desert" ? 0.5 * (env.time === "afternoon" ? 0 : 1) : 0) * (rain ? 0.3 : 1);
    const k = c.init ? Math.min(1, dt * 1.6) : 1; c.init = true;
    c.top.lerp(tgt.top, k); c.bottom.lerp(tgt.bottom, k); c.horizon.lerp(tgt.horizon, k); c.sun.lerp(tgt.sun, k);
    c.hemiSky.lerp(tgt.hemiSky, k); c.hemiGround.lerp(tgt.hemiGround, k); c.fog.lerp(tgt.fog, k); c.cloud.lerp(tgt.cloud, k);
    c.sunI += (L.sunI * env.ambient * (rain ? 0.55 : 1) - c.sunI) * k; c.hemiI += (L.hemiI * env.ambient - c.hemiI) * k;
    c.stars += (stars - c.stars) * k; c.night += (L.night - c.night) * k;
    c.sunPos.lerp(new THREE.Vector3(...L.sunPos), k);
    skyMat.uniforms.res.value.set(state.gl.domElement.width, state.gl.domElement.height);
    skyMat.uniforms.top.value.copy(c.top); skyMat.uniforms.bottom.value.copy(c.bottom); skyMat.uniforms.horizon.value.copy(c.horizon);
    fog.color.copy(c.fog); fog.near = R * 3.2; fog.far = R * 9;
    if (sun.current) { sun.current.color.copy(c.sun); sun.current.intensity = c.sunI; sun.current.position.copy(c.sunPos).normalize().multiplyScalar(R * 2.2); }
    if (hemi.current) { hemi.current.color.copy(c.hemiSky); hemi.current.groundColor.copy(c.hemiGround); hemi.current.intensity = c.hemiI; }
    if (moon.current) { moon.current.position.copy(c.sunPos).normalize().multiplyScalar(80); sunMat.color.copy(c.sun); sunMat.opacity = rain ? 0.2 : 0.85; }
    cloudColor.copy(c.cloud);
    starK.current = c.stars;
    FX.night = c.night;
    FX.fog.copy(c.fog);
    grassLight.time.value = FX.reduced ? 0 : FX.time;
    grassLight.sun.value.copy(c.sun).multiplyScalar(c.sunI * 0.3);
    grassLight.amb.value.copy(c.hemiSky).lerp(c.hemiGround, 0.35).multiplyScalar(c.hemiI * 0.55);
    if (rim.current) { rim.current.color.copy(c.hemiSky).lerp(new THREE.Color("#f2b2d6"), 0.3); rim.current.intensity = 0.9 * env.ambient; rim.current.position.copy(c.sunPos).multiplyScalar(-1).setY(6).normalize().multiplyScalar(R * 2); }
    updateGlows(c.night, FX.time);
  });

  const sh = R + 3;
  return (
    <group>
      <mesh geometry={G.sphere} material={skyMat} scale={130} frustumCulled={false} renderOrder={-10} />
      <Cosmos starsRef={starK} />
      <sprite ref={moon} material={sunMat} scale={[16, 16, 16]} />
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-sh} shadow-camera-right={sh} shadow-camera-top={sh} shadow-camera-bottom={-sh} shadow-camera-near={0.5} shadow-camera-far={R * 6} />
      <ambientLight intensity={0.12} />
      <directionalLight ref={rim} intensity={0.8} />
      <Clouds R={R} color={cloudColor} below={biome === "islands"} />
      <Rain R={R} on={env.weather === "rain"} />
      <Snow R={R} on={env.weather === "snow"} />
      {life && <>
        <Fireflies R={R} on={B.life.fireflies} />
        <Butterflies R={R} on={B.life.butterflies && env.weather === "clear"} />
        <Birds R={R} on={B.life.birds && env.weather !== "rain"} />
      </>}
    </group>
  );
}
