import type { ObjectKind, Surface } from "./types";

export interface Item {
  kind: ObjectKind;
  label: string;
  /** may sit on water */
  water?: boolean;
  /** default lift above ground */
  lift?: number;
  /** footprint radius (for spacing / selection ring) */
  r: number;
  /** min/max scale */
  scale: [number, number];
}

export type CategoryId = "nature" | "landscape" | "structures" | "magic";
export const CATEGORIES: { id: CategoryId; label: string; items: Item[] }[] = [
  {
    id: "nature", label: "Nature", items: [
      { kind: "tree", label: "Tree", r: 0.55, scale: [0.6, 1.8] },
      { kind: "pine", label: "Pine", r: 0.45, scale: [0.6, 1.8] },
      { kind: "bush", label: "Bush", r: 0.4, scale: [0.6, 1.8] },
      { kind: "flower", label: "Flowers", r: 0.3, scale: [0.6, 2] },
      { kind: "rock", label: "Rock", r: 0.45, scale: [0.5, 2.2] },
      { kind: "mushroom", label: "Mushroom", r: 0.3, scale: [0.6, 2.2] },
      { kind: "grass", label: "Grass", r: 0.3, scale: [0.6, 2] },
    ],
  },
  {
    id: "landscape", label: "Landscape", items: [
      { kind: "hill", label: "Hill", r: 1.2, scale: [0.6, 1.8] },
      { kind: "pond", label: "Pond", r: 1.0, scale: [0.6, 1.8] },
      { kind: "path", label: "Path", r: 0.8, scale: [0.6, 1.6] },
      { kind: "patch", label: "Meadow patch", r: 0.9, scale: [0.6, 1.8] },
      { kind: "tile", label: "Mosaic tile", r: 0.6, scale: [0.6, 1.8] },
    ],
  },
  {
    id: "structures", label: "Structures", items: [
      { kind: "cottage", label: "Cottage", r: 0.8, scale: [0.7, 1.5] },
      { kind: "cabin", label: "Cabin", r: 0.8, scale: [0.7, 1.5] },
      { kind: "tower", label: "Tower", r: 0.6, scale: [0.7, 1.6] },
      { kind: "bridge", label: "Bridge", r: 1.1, water: true, scale: [0.7, 1.6] },
      { kind: "windmill", label: "Windmill", r: 0.7, scale: [0.7, 1.5] },
    ],
  },
  {
    id: "magic", label: "Magic", items: [
      { kind: "crystal", label: "Crystals", r: 0.4, scale: [0.6, 2] },
      { kind: "lantern", label: "Lantern", r: 0.3, water: true, lift: 1.4, scale: [0.6, 2] },
      { kind: "magictree", label: "Magic tree", r: 0.6, scale: [0.6, 1.6] },
      { kind: "stars", label: "Star dust", r: 0.5, water: true, lift: 1.2, scale: [0.6, 2] },
      { kind: "portal", label: "Portal", r: 0.7, scale: [0.6, 1.6] },
    ],
  },
];

export const ITEMS: Record<ObjectKind, Item> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.items.map((i) => [i.kind, i]))
) as Record<ObjectKind, Item>;

export const CATEGORY_OF: Record<ObjectKind, CategoryId> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.items.map((i) => [i.kind, c.id]))
) as Record<ObjectKind, CategoryId>;

export type TerrainTool = "raise" | "lower" | "smooth" | "paint";
export const TERRAIN_TOOLS: { id: TerrainTool; label: string; hint: string }[] = [
  { id: "raise", label: "Raise", hint: "Drag to lift the ground" },
  { id: "lower", label: "Lower", hint: "Drag to dig valleys and lakes" },
  { id: "smooth", label: "Smooth", hint: "Drag to soften the land" },
  { id: "paint", label: "Paint", hint: "Drag to paint the ground" },
];
export const SURFACE_LABEL: Record<Surface, string> = {
  grass: "Grass", meadow: "Meadow", sand: "Sand", soil: "Soil", stone: "Stone", snow: "Snow", path: "Path", bloom: "Fairy soil",
};
