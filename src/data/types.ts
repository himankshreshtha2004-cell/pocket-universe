// World data schema. Visual presentation lives in src/three; this file is pure data.
export const SCHEMA_VERSION = 1;

export type BiomeId = "forest" | "islands" | "ocean" | "snow" | "desert" | "candy";
export type TimeOfDay = "morning" | "afternoon" | "sunset" | "night";
export type Weather = "clear" | "rain" | "snow";
export type WorldSize = "small" | "medium" | "large";

/** Ground surfaces that can be painted. Their colour comes from the biome palette. */
export const SURFACES = ["grass", "meadow", "sand", "soil", "stone", "snow", "path", "bloom"] as const;
export type Surface = (typeof SURFACES)[number];

export type ObjectKind =
  | "tree" | "pine" | "bush" | "flower" | "rock" | "mushroom" | "grass"
  | "hill" | "pond" | "path" | "patch" | "tile"
  | "cottage" | "cabin" | "tower" | "bridge" | "windmill"
  | "crystal" | "lantern" | "magictree" | "stars" | "portal";

export interface Env {
  time: TimeOfDay;
  weather: Weather;
  /** sky tint, hex; "" = biome default */
  sky: string;
  /** ambient light multiplier, 0.5 – 1.5 */
  ambient: number;
}

export interface Terrain {
  /** vertices per side */
  n: number;
  /** world units per cell */
  cell: number;
  /** island radius in world units */
  radius: number;
  /** water level (y) */
  water: number;
  /** n*n vertex heights */
  heights: number[];
  /** (n-1)*(n-1) cell surfaces, index into SURFACES */
  surface: number[];
  /** 64 rim radius factors around the island (organic coastline) */
  edge: number[];
}

export interface Placed {
  id: string;
  kind: ObjectKind;
  /** x, lift above ground, z */
  p: [number, number, number];
  /** rotation around Y (radians) */
  r: number;
  /** uniform scale */
  s: number;
  /** variant seed (shape / colour variety) */
  v: number;
}

export interface World {
  id: string;
  version: number;
  name: string;
  biome: BiomeId;
  seed: number;
  size: WorldSize;
  env: Env;
  terrain: Terrain;
  objects: Placed[];
  createdAt: number;
  updatedAt: number;
  /** small JPEG data URL */
  thumb?: string;
}

export interface Draft {
  biome: BiomeId;
  name: string;
  size: WorldSize;
  seed: number;
  env: Env;
}
