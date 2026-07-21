// ---------------------------------------------------------------------------
// Core data model for Structurize .blueprint files (NBT v1 format)
// ---------------------------------------------------------------------------

/** A Minecraft block state: name like "minecraft:oak_planks", optional props */
export interface BlockState {
  name: string
  properties?: Record<string, string>
}

/** Serialised block entity (tile entity) data at a relative position */
export interface TileEntity {
  x: number
  y: number
  z: number
  /** Raw NBT compound fields (id, data, TAG_BLUEPRINTDATA, etc.) */
  data: Record<string, unknown>
}

/** Serialised entity data at a relative position */
export interface EntityData {
  /** Relative position [x, y, z] doubles */
  pos: [number, number, number]
  /** Raw NBT compound fields */
  data: Record<string, unknown>
}

/**
 * The internal representation of a .blueprint file.
 *
 * Dimensions use the Structurize convention:
 *   structure[y][z][x] = index into palette
 *
 * Air is always palette index 0.
 */
export interface Blueprint {
  /** Palette of distinct block states. Index 0 is always air. */
  palette: BlockState[]

  /**
   * 3-D array of palette indices.
   * Access: structure[y][z][x]
   */
  structure: number[][][]

  sizeX: number
  sizeY: number
  sizeZ: number

  tileEntities: TileEntity[]
  entities: EntityData[]

  /** mod IDs beyond minecraft that this blueprint uses */
  requiredMods: string[]

  /** Minecraft data version integer (for NBT data-fixer compat) */
  mcVersion: number

  meta: BlueprintMeta
}

/** Metadata stored alongside (or within) the blueprint */
export interface BlueprintMeta {
  name: string
  fileName: string
  packName: string
  /** Position of the anchor (hut block / tag anchor) in structure coords */
  primaryOffset: { x: number; y: number; z: number }
  architects: string[]
}

// ---------------------------------------------------------------------------
// MineColonies schematic tag catalogue
// ---------------------------------------------------------------------------

/**
 * Tags assigned to blocks via IBlueprintDataProviderBE.
 * Stored as string lists in the block entity's TAG_BLUEPRINTDATA compound.
 */
export type McTag =
  | 'groundlevel'
  | 'invisible'
  | 'building_sign'
  | 'sit_in'
  | 'sit_out'
  | 'stand_in'
  | 'stand_out'
  | 'work'
  | 'cobble'
  | 'ladder'
  | 'portal'
  | 'stall'
  | 'gate'
  | 'knight'
  | 'archer'
  | 'leisure'
  | 'sugar_field'
  | 'cactus_field'
  | 'bamboo_field'
  | 'cocoa_field'
  | 'vine_field'
  | 'kelp_field'
  | 'seagrass_field'
  | 'seapickle_field'
  | 'glowb_field'
  | 'weepv_field'
  | 'twistv_field'
  | 'crimsonp_field'
  | 'warpedp_field'

export interface McTagMeta {
  tag: McTag | string
  label: string
  description: string
  /** Some tags carry a value, e.g. "job=miner" */
  hasValue?: boolean
}

export const MC_TAG_CATALOGUE: McTagMeta[] = [
  {
    tag: 'groundlevel',
    label: 'Ground Level',
    description:
      'Mark exactly one block at the nominal ground level. Affects Build Tool vertical alignment.',
  },
  {
    tag: 'invisible',
    label: 'Invisible',
    description:
      'Place on the anchor block to hide this schematic from survival-mode players in the Build Tool.',
  },
  {
    tag: 'building_sign',
    label: 'Building Sign',
    description:
      'Place on a sign-compatible block. It will automatically display the building name.',
  },
  { tag: 'sit_in', label: 'Indoor Sit', description: 'Indoor leisure seating position.' },
  { tag: 'sit_out', label: 'Outdoor Sit', description: 'Outdoor leisure seating position.' },
  { tag: 'stand_in', label: 'Indoor Stand', description: 'Indoor leisure standing position.' },
  { tag: 'stand_out', label: 'Outdoor Stand', description: 'Outdoor leisure standing position.' },
  { tag: 'work', label: 'Work Position', description: 'Worker action / standing position.' },
  { tag: 'cobble', label: 'Mine Cobble', description: 'Starting ladder shaft cobble blocks (Mine).' },
  { tag: 'ladder', label: 'Mine Ladder', description: 'Starting ladder shaft ladder blocks (Mine).' },
  { tag: 'portal', label: 'Nether Portal', description: 'Position where the nether portal appears (Nether Mine).' },
  { tag: 'stall', label: 'Horse Stall', description: 'Designates horse stalls (Stable). 2 per level.' },
  { tag: 'gate', label: 'Gate Walk', description: 'Walking position when passing through a Gatehouse gate.' },
  { tag: 'knight', label: 'Knight Post', description: 'Knight guard station in Gatehouse.' },
  { tag: 'archer', label: 'Archer Post', description: 'Archer guard station in Gatehouse.' },
  { tag: 'leisure', label: 'Leisure Site', description: 'Mark Decoration Controller as a leisure destination.' },
  { tag: 'sugar_field', label: 'Sugar Cane Field', description: 'Plantation field for sugar cane.' },
  { tag: 'cactus_field', label: 'Cactus Field', description: 'Plantation field for cactus.' },
  { tag: 'bamboo_field', label: 'Bamboo Field', description: 'Plantation field for bamboo.' },
  { tag: 'cocoa_field', label: 'Cocoa Field', description: 'Plantation field for cocoa.' },
  { tag: 'vine_field', label: 'Vine Field', description: 'Plantation field for vines.' },
  { tag: 'kelp_field', label: 'Kelp Field', description: 'Plantation field for kelp.' },
]

// ---------------------------------------------------------------------------
// Editor tool modes
// ---------------------------------------------------------------------------

export type ToolMode = 'select' | 'place' | 'erase' | 'paint' | 'pick' | 'tag'
