// Cinematic finishing: glow on everything that shines, a tilt-shift "miniature" focus band,
// gentle colour grading and a soft vignette.
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, TiltShift2, Vignette } from "@react-three/postprocessing";

export function Effects({ tilt = true, bloom = 1 }: { tilt?: boolean; bloom?: number }) {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.55 * bloom} luminanceThreshold={1.0} luminanceSmoothing={0.15} radius={0.6} />
      {tilt ? <TiltShift2 blur={0.16} taper={0.55} start={[0, 0.56]} end={[1, 0.56]} samples={8} /> : <></>}
      <HueSaturation saturation={0.14} />
      <BrightnessContrast brightness={0.01} contrast={0.06} />
      <Vignette offset={0.32} darkness={0.42} eskil={false} />
    </EffectComposer>
  );
}
