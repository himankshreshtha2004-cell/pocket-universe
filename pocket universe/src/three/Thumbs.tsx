// Renders small images of real 3D content (item cards, biome cards) off-screen, using the main renderer.
import { createPortal, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

interface Job { key: string; node: ReactNode; w: number; h: number; dir: THREE.Vector3; pad: number; resolve: (u: string) => void }
const queue: Job[] = [];
const cache = new Map<string, string>();
const waiting = new Map<string, Promise<string>>();
let wake: (() => void) | null = null;

export function thumb(key: string, node: ReactNode, o: { w?: number; h?: number; dir?: [number, number, number]; pad?: number } = {}): Promise<string> {
  const hit = cache.get(key); if (hit) return Promise.resolve(hit);
  const w8 = waiting.get(key); if (w8) return w8;
  const p = new Promise<string>((resolve) => {
    queue.push({ key, node, w: o.w ?? 160, h: o.h ?? 160, dir: new THREE.Vector3(...(o.dir ?? [1, 0.75, 1.2])).normalize(), pad: o.pad ?? 1.15, resolve });
    wake?.();
  });
  waiting.set(key, p);
  return p;
}
export const cachedThumb = (key: string) => cache.get(key);

export function ThumbFactory() {
  const [job, setJob] = useState<Job | null>(null);
  const scene = useMemo(() => { const s = new THREE.Scene(); return s; }, []);
  const content = useRef<THREE.Group>(null);
  const frames = useRef(0);
  const cam = useMemo(() => new THREE.PerspectiveCamera(30, 1, 0.05, 200), []);
  const rt = useRef<THREE.WebGLRenderTarget | null>(null);
  useEffect(() => {
    wake = () => setJob((j) => j ?? queue.shift() ?? null);
    wake();
    return () => { wake = null; rt.current?.dispose(); };
  }, []);
  useFrame(({ gl }) => {
    if (!job || !content.current) return;
    if (++frames.current < 3) return;
    frames.current = 0;
    const W = job.w * 2, H = job.h * 2;
    if (!rt.current || rt.current.width !== W || rt.current.height !== H) {
      rt.current?.dispose();
      rt.current = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
      rt.current.texture.colorSpace = THREE.SRGBColorSpace;
    }
    // frame the content
    const box = new THREE.Box3().setFromObject(content.current);
    const sph = box.getBoundingSphere(new THREE.Sphere());
    cam.aspect = W / H; cam.fov = 30; cam.updateProjectionMatrix();
    const fit = (sph.radius * job.pad) / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) / Math.min(1, cam.aspect);
    cam.position.copy(sph.center).addScaledVector(job.dir, fit);
    cam.lookAt(sph.center);
    const prevT = gl.getRenderTarget(), prevC = gl.getClearColor(new THREE.Color()), prevA = gl.getClearAlpha();
    gl.setRenderTarget(rt.current); gl.setClearColor(0x000000, 0); gl.clear();
    gl.render(scene, cam);
    const px = new Uint8Array(W * H * 4);
    gl.readRenderTargetPixels(rt.current, 0, 0, W, H, px);
    gl.setRenderTarget(prevT); gl.setClearColor(prevC, prevA);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d")!, img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    const url = c.toDataURL("image/png");
    cache.set(job.key, url); waiting.delete(job.key); job.resolve(url);
    setJob(queue.shift() ?? null);
  });
  if (!job) return null;
  return createPortal(
    <>
      <hemisphereLight args={["#e6ecff", "#b9a6c9", 1.3]} />
      <directionalLight position={[4, 7, 5]} intensity={2.2} color="#fff4e6" />
      <directionalLight position={[-5, 2, -3]} intensity={0.6} color="#a9c9f5" />
      <group ref={content} key={job.key}>{job.node}</group>
    </>,
    scene
  );
}
