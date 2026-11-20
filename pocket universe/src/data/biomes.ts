import type { BiomeId, Env, ObjectKind, Surface, TimeOfDay, Weather } from "./types";

export interface Palette {
  surface: Record<Surface, string>;
  under: [string, string];        // underside rock: top, bottom
  water: string;
  waterDeep: string;
  waterOpacity: number;
  frozen?: boolean;
  foliage: string[];
  trunk: string;
  rock: string[];
  wall: string;
  roof: string;
  wood: string;
  accent: string;                 // doors, flags, details
  flowers: string[];
  glow: string;                   // magic glow
  cloud: string;
}

export interface Biome {
  id: BiomeId;
  name: string;
  blurb: string;
  palette: Palette;
  treeStyle: "oak" | "pine" | "palm" | "candy";
  defaults: Pick<Env, "time" | "weather">;
  weathers: Weather[];
  /** terrain generation */
  gen: { base: number; amp: number; freq: number; water: number; ridge?: boolean; peaks?: number };
  /** height bands -> surface (checked in order: first match where h < max) */
  bands: { max: number; s: Surface }[];
  /** starter objects: kind and weight */
  starters: [ObjectKind, number][];
  life: { fireflies: boolean; butterflies: boolean; birds: boolean };
  /** UI accent for cards */
  ui: [string, string];
}

const base = (o: Partial<Palette> & Pick<Palette, "surface">): Palette => ({
  under: ["#8a6a55", "#4b3a4e"], water: "#6fd3d8", waterDeep: "#2f7f9c", waterOpacity: 0.82,
  foliage: ["#7cc48a", "#5fae7a", "#9bd38c"], trunk: "#8b6248", rock: ["#9aa0b5", "#b9bccb", "#7f8597"],
  wall: "#fff1df", roof: "#c96b6b", wood: "#a5714f", accent: "#f2b2d6", flowers: ["#f2b2d6", "#fff7ea", "#f6c6a6", "#a9c9f5"],
  glow: "#87dccf", cloud: "#ffffff", ...o,
});

export const BIOMES: Record<BiomeId, Biome> = {
  forest: {
    id: "forest", name: "Enchanted Forest", blurb: "Green hills, giant trees, glowing mushrooms and cosy cottages.",
    palette: base({
      surface: { grass: "#7fc77c", meadow: "#a6d67f", sand: "#e9d39f", soil: "#9a7556", stone: "#a9a7b6", snow: "#f4f6ff", path: "#d9c19a", bloom: "#c79be6" },
      foliage: ["#5fb77a", "#7cc87d", "#4ea37a", "#94d488"], roof: "#c76f5e", accent: "#f2b2d6", glow: "#b7f5c9",
    }),
    treeStyle: "oak", defaults: { time: "afternoon", weather: "clear" }, weathers: ["clear", "rain", "snow"],
    gen: { base: 0.35, amp: 1.5, freq: 0.16, water: 0.12 },
    bands: [{ max: 0.2, s: "sand" }, { max: 0.9, s: "grass" }, { max: 1.45, s: "meadow" }, { max: 99, s: "stone" }],
    starters: [["tree", 10], ["pine", 3], ["bush", 5], ["mushroom", 4], ["rock", 3], ["flower", 5], ["cottage", 1], ["lantern", 1]],
    life: { fireflies: true, butterflies: true, birds: true }, ui: ["#87dccf", "#5fb77a"],
  },
  islands: {
    id: "islands", name: "Floating Islands", blurb: "Islands above the clouds, waterfalls into the sky, floating ruins.",
    palette: base({
      surface: { grass: "#8fd39a", meadow: "#b8e3a0", sand: "#efdcb0", soil: "#a08066", stone: "#b8b8cc", snow: "#f5f7ff", path: "#e6d3b0", bloom: "#f2b2d6" },
      under: ["#9b8577", "#5d5878"], foliage: ["#7fcf9a", "#a2dd9b", "#6cbf9a"], roof: "#8177c9", accent: "#a9c9f5", glow: "#a9c9f5",
    }),
    treeStyle: "oak", defaults: { time: "morning", weather: "clear" }, weathers: ["clear", "rain", "snow"],
    gen: { base: 0.45, amp: 1.2, freq: 0.14, water: 0.18 },
    bands: [{ max: 0.26, s: "sand" }, { max: 1.0, s: "grass" }, { max: 1.5, s: "meadow" }, { max: 99, s: "stone" }],
    starters: [["tree", 7], ["bush", 4], ["rock", 4], ["flower", 5], ["tower", 1], ["crystal", 1], ["grass", 3]],
    life: { fireflies: true, butterflies: true, birds: true }, ui: ["#a9c9f5", "#8177c9"],
  },
  ocean: {
    id: "ocean", name: "Ocean Paradise", blurb: "Turquoise lagoons, palm-lined beaches and little coastal houses.",
    palette: base({
      surface: { grass: "#86cf86", meadow: "#a9dc8b", sand: "#f6e3b4", soil: "#b08a63", stone: "#c2bdb4", snow: "#f6f8ff", path: "#efd9b2", bloom: "#f2a9c9" },
      under: ["#c9a77f", "#6b5a74"], water: "#59d6d0", waterDeep: "#1f8fb0", waterOpacity: 0.8,
      foliage: ["#5cc48a", "#7fd08a", "#4bb685"], trunk: "#a37a52", wall: "#fffaf0", roof: "#5fb7c9", accent: "#f6c6a6", glow: "#87dccf",
    }),
    treeStyle: "palm", defaults: { time: "afternoon", weather: "clear" }, weathers: ["clear", "rain"],
    gen: { base: -0.15, amp: 1.5, freq: 0.13, water: 0.15 },
    bands: [{ max: 0.42, s: "sand" }, { max: 1.1, s: "grass" }, { max: 99, s: "meadow" }],
    starters: [["tree", 9], ["bush", 4], ["rock", 4], ["flower", 3], ["cottage", 2], ["grass", 3]],
    life: { fireflies: false, butterflies: true, birds: true }, ui: ["#59d6d0", "#1f8fb0"],
  },
  snow: {
    id: "snow", name: "Dreamy Snowland", blurb: "Snowy peaks, pine forests, little cabins and frozen lakes.",
    palette: base({
      surface: { grass: "#9fc7b0", meadow: "#c9dde0", sand: "#e3dccb", soil: "#8f7a70", stone: "#a9b0c4", snow: "#f7f9ff", path: "#cdbfae", bloom: "#c9b8f0" },
      under: ["#9aa3bd", "#4d4f72"], water: "#bfe7f5", waterDeep: "#8cc3e3", waterOpacity: 0.92, frozen: true,
      foliage: ["#3f7f74", "#4f8f7d", "#356f6b"], trunk: "#7b5a4a", rock: ["#a9b0c4", "#c9cfe0", "#8c93ab"],
      wall: "#b98563", roof: "#f7f9ff", wood: "#8a5d43", accent: "#e98a8a", glow: "#a9c9f5", cloud: "#f2f5ff",
    }),
    treeStyle: "pine", defaults: { time: "morning", weather: "snow" }, weathers: ["clear", "snow"],
    gen: { base: 0.4, amp: 2.1, freq: 0.15, water: 0.2, peaks: 1 },
    bands: [{ max: 0.6, s: "snow" }, { max: 0.95, s: "grass" }, { max: 1.6, s: "snow" }, { max: 99, s: "stone" }],
    starters: [["pine", 14], ["rock", 4], ["cabin", 2], ["bush", 2], ["lantern", 1]],
    life: { fireflies: false, butterflies: false, birds: true }, ui: ["#a9c9f5", "#f7f9ff"],
  },
  desert: {
    id: "desert", name: "Celestial Desert", blurb: "Golden dunes, strange rocks, an oasis and endless stars.",
    palette: base({
      surface: { grass: "#a8c77a", meadow: "#d9c98a", sand: "#f0c98a", soil: "#c98f63", stone: "#c99a7a", snow: "#fff7ea", path: "#e8b98a", bloom: "#e7a0c4" },
      under: ["#d19a6e", "#6a4a62"], water: "#5fd0c8", waterDeep: "#2a8f98",
      foliage: ["#6fae6a", "#8cbf6a", "#5e9e66"], trunk: "#9a6b4a", rock: ["#d08a62", "#e0a477", "#b8735a"],
      wall: "#f2d2a8", roof: "#d59a6a", wood: "#a5714f", accent: "#8177c9", glow: "#f6c6a6",
    }),
    treeStyle: "palm", defaults: { time: "sunset", weather: "clear" }, weathers: ["clear"],
    gen: { base: 0.3, amp: 1.0, freq: 0.12, water: -0.22, ridge: true },
    bands: [{ max: 0.12, s: "grass" }, { max: 99, s: "sand" }],
    starters: [["rock", 8], ["tree", 3], ["crystal", 2], ["tower", 1], ["grass", 2], ["portal", 1]],
    life: { fireflies: false, butterflies: false, birds: true }, ui: ["#f6c6a6", "#d08a62"],
  },
  candy: {
    id: "candy", name: "Candy Dream", blurb: "Pastel hills, giant flowers, pink trees and sugar-cloud skies.",
    palette: base({
      surface: { grass: "#bfe8cf", meadow: "#f6d1e4", sand: "#fff0cf", soil: "#e7b9a3", stone: "#d8cdf0", snow: "#fff7ea", path: "#ffe6c7", bloom: "#f2b2d6" },
      under: ["#f2b2d6", "#8177c9"], water: "#f7c4dd", waterDeep: "#c79be6", waterOpacity: 0.85,
      foliage: ["#f7a8cf", "#f2c1dc", "#c7b2f2", "#9fe3d0"], trunk: "#f6c6a6", rock: ["#d8cdf0", "#c7e7f5", "#f6d1e4"],
      wall: "#fff7ea", roof: "#f28fb8", wood: "#f6c6a6", accent: "#87dccf", flowers: ["#ff9fcb", "#fff7ea", "#a9c9f5", "#ffd58a"], glow: "#f2b2d6", cloud: "#fff0f7",
    }),
    treeStyle: "candy", defaults: { time: "afternoon", weather: "clear" }, weathers: ["clear", "rain", "snow"],
    gen: { base: 0.4, amp: 1.2, freq: 0.15, water: 0.14 },
    bands: [{ max: 0.24, s: "sand" }, { max: 0.95, s: "grass" }, { max: 99, s: "meadow" }],
    starters: [["tree", 9], ["flower", 8], ["mushroom", 4], ["bush", 3], ["cottage", 1], ["crystal", 1], ["lantern", 1]],
    life: { fireflies: true, butterflies: true, birds: false }, ui: ["#f2b2d6", "#c7b2f2"],
  },
};

export const BIOME_ORDER: BiomeId[] = ["forest", "islands", "ocean", "snow", "desert", "candy"];

/** Lighting keyframes per time of day (blended smoothly at runtime). */
export interface Light {
  skyTop: string; skyBottom: string; horizon: string;
  sun: string; sunI: number; sunPos: [number, number, number];
  hemiSky: string; hemiGround: string; hemiI: number;
  fog: string; stars: number; night: number; water: string;
}
export const LIGHTS: Record<TimeOfDay, Light> = {
  morning:   { skyTop: "#7fa6e6", skyBottom: "#f6d7c8", horizon: "#fff1df", sun: "#ffe7c7", sunI: 2.1, sunPos: [14, 9, 9],  hemiSky: "#cfe2ff", hemiGround: "#d9b9a6", hemiI: 1.05, fog: "#e9e0ef", stars: 0.0, night: 0, water: "#ffffff" },
  afternoon: { skyTop: "#5f95e6", skyBottom: "#bfe1f2", horizon: "#f2fbff", sun: "#fff6e6", sunI: 2.5, sunPos: [6, 16, 7],  hemiSky: "#dff0ff", hemiGround: "#b8c9a6", hemiI: 1.15, fog: "#d6e8f5", stars: 0.0, night: 0, water: "#ffffff" },
  sunset:    { skyTop: "#4b3f8f", skyBottom: "#f6a98a", horizon: "#ffc7a0", sun: "#ffbf94", sunI: 1.9, sunPos: [-15, 5, 6], hemiSky: "#c9b3ec", hemiGround: "#d9a8b0", hemiI: 1.0, fog: "#d9a3b5", stars: 0.25, night: 0.3, water: "#ffd2c0" },
  night:     { skyTop: "#0b0d24", skyBottom: "#242044", horizon: "#3b3470", sun: "#a9b8ff", sunI: 0.75, sunPos: [-8, 12, -10], hemiSky: "#5a5aa8", hemiGround: "#2a2440", hemiI: 0.62, fog: "#242044", stars: 1.0, night: 1, water: "#a9b8ff" },
};
export const TIMES: TimeOfDay[] = ["morning", "afternoon", "sunset", "night"];
export const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", afternoon: "Afternoon", sunset: "Sunset", night: "Night" };
export const WEATHER_LABEL: Record<Weather, string> = { clear: "Clear", rain: "Rainy", snow: "Snowy" };

export const SKY_TINTS = ["", "#F2B2D6", "#87DCCF", "#F6C6A6", "#A9C9F5", "#8177C9", "#FFF7EA"];

const A = ["Moonberry", "Whisper", "Cloud", "Velvet", "Little", "Lantern", "Honey", "Star", "Fern", "Silver", "Dandelion", "Amber", "Misty", "Sugar", "Hollow", "Echo", "Juniper", "Comet", "Driftwood", "Saffron"];
const B = ["Valley", "Hollow", "Reach", "Isle", "Garden", "Haven", "Meadow", "Atlantis", "Dunes", "Peaks", "Cove", "Grove", "Nook", "Harbour", "Falls", "Glen", "Orchard", "Drift", "Shore", "Basin"];
const SPECIAL = ["The Forgotten Garden", "Cloud Nine", "Little Atlantis", "Dreamland 01", "Moonberry Valley", "Sleepy Comet", "Tiny Tomorrow", "Somewhere Soft"];
export function randomName() {
  if (Math.random() < 0.2) return SPECIAL[Math.floor(Math.random() * SPECIAL.length)];
  return A[Math.floor(Math.random() * A.length)] + " " + B[Math.floor(Math.random() * B.length)];
}
export const NAME_EXAMPLES = ["Moonberry Valley", "The Forgotten Garden", "Cloud Nine", "Little Atlantis", "Dreamland 01"];
