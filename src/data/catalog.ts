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

/** every item can be shrunk to 30% or grown to 300% */
export const SIZE: [number, number] = [0.3, 3];

export type CategoryId = "nature" | "landscape" | "structures" | "magic" | "friends";
export const CATEGORIES: { id: CategoryId; label: string; items: Item[] }[] = [
  {
    id: "nature", label: "Nature", items: [
      { kind: "tree", label: "Tree", r: 0.55, scale: SIZE },
      { kind: "pine", label: "Pine", r: 0.45, scale: SIZE },
      { kind: "bush", label: "Bush", r: 0.4, scale: SIZE },
      { kind: "flower", label: "Flowers", r: 0.3, scale: SIZE },
      { kind: "rock", label: "Rock", r: 0.45, scale: SIZE },
      { kind: "mushroom", label: "Mushroom", r: 0.3, scale: SIZE },
      { kind: "grass", label: "Grass", r: 0.3, scale: SIZE },
    ],
  },
  {
    id: "landscape", label: "Landscape", items: [
      { kind: "hill", label: "Hill", r: 1.2, scale: SIZE },
      { kind: "pond", label: "Pond", r: 1.0, scale: SIZE },
      { kind: "path", label: "Path", r: 0.8, scale: SIZE },
      { kind: "patch", label: "Meadow patch", r: 0.9, scale: SIZE },
      { kind: "tile", label: "Mosaic tile", r: 0.6, scale: SIZE },
    ],
  },
  {
    id: "structures", label: "Structures", items: [
      { kind: "cottage", label: "Cottage", r: 0.8, scale: SIZE },
      { kind: "cabin", label: "Cabin", r: 0.8, scale: SIZE },
      { kind: "tower", label: "Tower", r: 0.6, scale: SIZE },
      { kind: "bridge", label: "Bridge", r: 1.1, water: true, scale: SIZE },
      { kind: "windmill", label: "Windmill", r: 0.7, scale: SIZE },
      { kind: "roundhut", label: "Round hut", r: 0.7, scale: SIZE },
      { kind: "manor", label: "Manor", r: 1.0, scale: SIZE },
      { kind: "mushhouse", label: "Mushroom house", r: 0.7, scale: SIZE },
      { kind: "treehouse", label: "Treehouse", r: 0.8, scale: SIZE },
    ],
  },
  {
    id: "magic", label: "Magic", items: [
      { kind: "crystal", label: "Crystals", r: 0.4, scale: SIZE },
      { kind: "lantern", label: "Lantern", r: 0.3, water: true, lift: 1.4, scale: SIZE },
      { kind: "magictree", label: "Magic tree", r: 0.6, scale: SIZE },
      { kind: "stars", label: "Star dust", r: 0.5, water: true, lift: 1.2, scale: SIZE },
      { kind: "portal", label: "Portal", r: 0.7, scale: SIZE },
      { kind: "fairylights", label: "Fairy lights", r: 0.9, scale: SIZE },
      { kind: "fairy", label: "Fairy", r: 0.3, water: true, lift: 1.1, scale: SIZE },
      { kind: "glitter", label: "Glitter", r: 0.5, water: true, lift: 0.7, scale: SIZE },
      { kind: "hangingtree", label: "Hanging garden", r: 0.9, scale: SIZE },
    ],
  },
  {
    id: "friends", label: "Friends", items: [
      { kind: "woman", label: "Girl", r: 0.25, scale: SIZE },
      { kind: "man", label: "Boy", r: 0.25, scale: SIZE },
      { kind: "dog", label: "Doggy", r: 0.3, scale: SIZE },
      { kind: "gnome", label: "Garden gnome", r: 0.25, scale: SIZE },
    ],
  },
];

export const ITEMS: Record<ObjectKind, Item> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.items.map((i) => [i.kind, i]))
) as Record<ObjectKind, Item>;

export const CATEGORY_OF: Record<ObjectKind, CategoryId> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.items.map((i) => [i.kind, c.id]))
) as Record<ObjectKind, CategoryId>;

export type TerrainTool = "raise" | "lower" | "smooth" | "river" | "paint" | "erase";
export const TERRAIN_TOOLS: { id: TerrainTool; label: string; hint: string }[] = [
  { id: "raise", label: "Raise", hint: "Drag to lift the ground" },
  { id: "lower", label: "Lower", hint: "Drag to dig valleys and lakes" },
  { id: "smooth", label: "Smooth", hint: "Drag to soften the land" },
  { id: "river", label: "River", hint: "Drag to dig a river or a lake" },
  { id: "paint", label: "Paint", hint: "Drag to paint the ground" },
  { id: "erase", label: "Eraser", hint: "Drag over things to erase them" },
];
export const SURFACE_LABEL: Record<Surface, string> = {
  grass: "Grass", meadow: "Meadow", sand: "Sand", soil: "Soil", stone: "Stone", snow: "Snow", path: "Path", bloom: "Fairy soil",
};
