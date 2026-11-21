// A gentle, endless lullaby made on the fly with WebAudio: soft pad chords, a warm bass
// and a music-box melody wandering over a pentatonic scale. No audio files needed.

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// I – vi – IV – V in C, with a dreamy add9 / maj7 flavour
const CHORDS = [
  [48, 55, 60, 64, 67, 74], // Cadd9
  [45, 52, 57, 60, 64, 71], // Am7(9)
  [41, 48, 53, 57, 60, 64], // Fmaj7
  [43, 50, 55, 59, 62, 69], // G6/9
];
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88]; // C major pentatonic, music-box register
const BEAT = 0.5; // seconds per eighth-ish step
const BAR = 16;   // steps per chord

let ctx: AudioContext | null = null;
let master: GainNode, padBus: GainNode, bellBus: GainNode, delay: DelayNode;
let timer: number | undefined, nextTime = 0, step = 0, note = 3, playing = false;

function setup() {
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);

  // soft reverb from a generated impulse
  const verb = ctx.createConvolver();
  const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ir;
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.55;
  verb.connect(verbGain).connect(master);

  padBus = ctx.createGain(); padBus.gain.value = 0.16;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = 0.3;
  padBus.connect(lp); lp.connect(master); lp.connect(verb);

  bellBus = ctx.createGain(); bellBus.gain.value = 0.12;
  delay = ctx.createDelay(2); delay.delayTime.value = BEAT * 1.5;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2600;
  bellBus.connect(master); bellBus.connect(verb); bellBus.connect(delay);
  delay.connect(dlp).connect(fb).connect(delay); dlp.connect(master);
}

function pad(freq: number, t: number, dur: number, gain: number) {
  if (!ctx) return;
  for (const [type, det, g] of [["triangle", -6, 1], ["sine", 5, 0.8]] as const) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = det;
    v.gain.setValueAtTime(0, t);
    v.gain.linearRampToValueAtTime(gain * g, t + 1.6);
    v.gain.setValueAtTime(gain * g, t + dur - 1.4);
    v.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    o.connect(v).connect(padBus);
    o.start(t); o.stop(t + dur + 0.7);
  }
}
function bell(freq: number, t: number, vel: number) {
  if (!ctx) return;
  // a sine with a bright inharmonic partial: music box / celesta
  for (const [mul, g, dec] of [[1, 1, 1.6], [2.76, 0.28, 0.5], [5.4, 0.08, 0.25]] as const) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq * mul;
    v.gain.setValueAtTime(0, t);
    v.gain.linearRampToValueAtTime(vel * g, t + 0.008);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(v).connect(bellBus);
    o.start(t); o.stop(t + dec + 0.05);
  }
}
function bass(freq: number, t: number, dur: number) {
  if (!ctx) return;
  const o = ctx.createOscillator(), v = ctx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.22, t + 0.08); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(v).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.3) {
    const bar = Math.floor(step / BAR) % CHORDS.length, inBar = step % BAR, chord = CHORDS[bar];
    if (inBar === 0) {
      const dur = BAR * BEAT;
      chord.slice(1, 5).forEach((n) => pad(midi(n), nextTime, dur, 0.09));
      bass(midi(chord[0] - 12), nextTime, BEAT * 7);
      bass(midi(chord[0] - 12), nextTime + BEAT * 8, BEAT * 7);
    }
    // melody: a lazy random walk, with rests, leaning toward chord tones on the strong beats
    const strong = inBar % 4 === 0;
    if (Math.random() < (strong ? 0.85 : 0.42)) {
      note = Math.max(0, Math.min(SCALE.length - 1, note + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      let n = SCALE[note];
      if (strong) { const tones = chord.map((c) => c % 12); while (!tones.includes(n % 12) && n > SCALE[0]) n -= 1; }
      const swing = inBar % 2 ? BEAT * 0.08 : 0;
      bell(midi(n), nextTime + swing, strong ? 0.5 : 0.32);
      if (Math.random() < 0.12) bell(midi(n + 12), nextTime + swing + BEAT / 2, 0.16); // a little sparkle
    }
    nextTime += BEAT;
    step++;
  }
}

export const music = {
  get playing() { return playing; },
  /** must be called from a click / key press (browsers block sound until the visitor interacts) */
  async start() {
    if (!ctx) setup();
    if (!ctx) return;
    await ctx.resume();
    if (playing) return;
    playing = true;
    nextTime = ctx.currentTime + 0.1;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 2.5);
    schedule();
    timer = window.setInterval(schedule, 100);
  },
  stop() {
    if (!ctx || !playing) return;
    playing = false;
    window.clearInterval(timer);
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 1.2);
    // stop scheduling; already-queued notes fade out under the master ramp
    step = Math.ceil(step / BAR) * BAR;
  },
};
