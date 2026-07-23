/**
 * Block registry.
 *
 * Combines:
 *   1. Vanilla Minecraft blocks (via minecraft-data, MIT licensed)
 *   2. Structurize special blocks
 *   3. MineColonies hut blocks
 *   4. Domum Ornamentum marker entry
 *
 * Each entry carries a representative hex color used for rendering when a
 * texture atlas is not available.
 */

// Static pre-generated block list (run scripts/generate-blocks.mjs to regenerate).
// Using a static JSON avoids minecraft-data's Node.js __dirname / require() at runtime.
import vanillaBlocksJson from './vanilla-blocks-1.21.json'

interface McDataBlock {
  id: number
  name: string
  displayName: string
  hardness?: number
}

export interface BlockEntry {
  /** Full namespaced block ID, e.g. "minecraft:stone" */
  id: string
  displayName: string
  /** CSS hex color for rendering without textures */
  color: string
  /** Which namespace / tab this block belongs to */
  namespace: 'minecraft' | 'structurize' | 'minecolonies' | 'domum_ornamentum' | string
}

// ---------------------------------------------------------------------------
// Approximate colors for vanilla blocks (a curated subset)
// ---------------------------------------------------------------------------
const BLOCK_COLORS: Record<string, string> = {
  'minecraft:air': '#00000000',
  'minecraft:stone': '#888888',
  'minecraft:granite': '#9d6b4a',
  'minecraft:polished_granite': '#b07858',
  'minecraft:diorite': '#c8c8c8',
  'minecraft:andesite': '#767676',
  'minecraft:grass_block': '#5a9e3e',
  'minecraft:dirt': '#8f5f3f',
  'minecraft:cobblestone': '#777777',
  'minecraft:oak_planks': '#b88a4a',
  'minecraft:spruce_planks': '#7a5c34',
  'minecraft:birch_planks': '#d4c07a',
  'minecraft:jungle_planks': '#a0703c',
  'minecraft:acacia_planks': '#ba6d3c',
  'minecraft:dark_oak_planks': '#4a3220',
  'minecraft:mangrove_planks': '#7a3028',
  'minecraft:cherry_planks': '#dba0a0',
  'minecraft:bamboo_planks': '#d4b85a',
  'minecraft:crimson_planks': '#6e2c44',
  'minecraft:warped_planks': '#2c6e5c',
  'minecraft:sand': '#d4c07a',
  'minecraft:gravel': '#888070',
  'minecraft:gold_ore': '#888850',
  'minecraft:iron_ore': '#888888',
  'minecraft:coal_ore': '#444444',
  'minecraft:oak_log': '#6e5030',
  'minecraft:spruce_log': '#4a3820',
  'minecraft:birch_log': '#c8c0a0',
  'minecraft:glass': '#aaddff80',
  'minecraft:white_wool': '#f0f0f0',
  'minecraft:red_wool': '#cc2222',
  'minecraft:blue_wool': '#2244cc',
  'minecraft:green_wool': '#448844',
  'minecraft:yellow_wool': '#ddcc22',
  'minecraft:black_wool': '#222222',
  'minecraft:bricks': '#9a5040',
  'minecraft:bookshelf': '#b09050',
  'minecraft:obsidian': '#1a0a30',
  'minecraft:snow_block': '#f8f8ff',
  'minecraft:ice': '#a0c8ff',
  'minecraft:netherrack': '#6e2828',
  'minecraft:soul_sand': '#4a3828',
  'minecraft:glowstone': '#e0c060',
  'minecraft:white_concrete': '#e8e8e8',
  'minecraft:gray_concrete': '#585858',
  'minecraft:stone_bricks': '#888888',
  'minecraft:deepslate': '#484858',
  'minecraft:copper_block': '#c07850',
  'minecraft:quartz_block': '#e8e0d0',
  'minecraft:prismarine': '#5a9090',
  'minecraft:end_stone': '#d8d8a0',
  'minecraft:purpur_block': '#9878a0',
  'minecraft:hay_block': '#c8a830',
  'minecraft:lava': '#e06000',
  'minecraft:water': '#3F76E4',
}

function colorForBlock(id: string): string {
  return BLOCK_COLORS[id] ?? '#aaaaaa'
}

// ---------------------------------------------------------------------------
// Build the registry
// ---------------------------------------------------------------------------

const _registry = new Map<string, BlockEntry>()

function register(entry: BlockEntry) {
  _registry.set(entry.id, entry)
}

// 1. Vanilla blocks from pre-generated JSON
for (const block of vanillaBlocksJson as McDataBlock[]) {
  const id = `minecraft:${block.name}`
  register({
    id,
    displayName: block.displayName,
    color: colorForBlock(id),
    namespace: 'minecraft',
  })
}

// 2. Structurize special blocks
const STRUCTURIZE_BLOCKS: Array<[string, string]> = [
  ['structurize:blocksubstitution', 'Substitution Block (Any)'],
  ['structurize:blocksolidsubstitution', 'Substitution Block (Solid)'],
  ['structurize:blockfluidsubstitution', 'Substitution Block (Fluid)'],
  ['structurize:blocktag_anchor', 'Tag Anchor Block'],
  ['structurize:blocktagsubstitution', 'Tag Substitution Block'],
]
for (const [id, displayName] of STRUCTURIZE_BLOCKS) {
  register({ id, displayName, color: '#7755cc', namespace: 'structurize' })
}

// 3. MineColonies hut blocks
const HUT_NAMES: string[] = [
  'alchemist', 'archery', 'baker', 'barracks', 'barrackstower',
  'beekeeper', 'blacksmith', 'builder', 'chickencoop', 'combatacademy',
  'composter', 'concretemixer', 'cook', 'cowherder', 'crusher',
  'deliveryman', 'dyer', 'enchanter', 'farmer', 'fisherman',
  'fletcher', 'florist', 'glassblower', 'graveyard', 'guardtower',
  'hospital', 'library', 'lumberjack', 'mechanic', 'miner',
  'mysticalsite', 'netherworker', 'plantation', 'rabbithutch', 'sawmill',
  'school', 'shepherd', 'sifter', 'smeltery', 'stonemason',
  'stonesmeltery', 'swineherder', 'tavern', 'townhall', 'university',
  'warehouse', 'residence', 'citizen',
]
for (const name of HUT_NAMES) {
  const id = `minecolonies:blockhut${name}`
  register({
    id,
    displayName: name.charAt(0).toUpperCase() + name.slice(1) + "'s Hut Block",
    color: '#cc6600',
    namespace: 'minecolonies',
  })
}
// Decoration Controller
register({
  id: 'minecolonies:blockdecorationcontroller',
  displayName: 'Decoration Controller',
  color: '#ff8800',
  namespace: 'minecolonies',
})

// 4. Domum Ornamentum placeholder
register({
  id: 'domum_ornamentum:__composite__',
  displayName: 'Domum Ornamentum Block (composite)',
  color: '#aa88cc',
  namespace: 'domum_ornamentum',
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** All registered blocks, sorted alphabetically within each namespace */
export function getAllBlocks(): BlockEntry[] {
  return [..._registry.values()]
}

/** Look up a block entry by its full namespaced ID.
 * Strips blockstate properties (e.g. `minecraft:oak_stairs[facing=north,...]` → `minecraft:oak_stairs`)
 * so real .blueprint files with blockstate data resolve correctly.
 */
export function getBlock(id: string): BlockEntry | undefined {
  // Domum Ornamentum blocks all map to the composite entry
  if (id.startsWith('domum_ornamentum:')) {
    return _registry.get('domum_ornamentum:__composite__')
  }
  // Strip blockstate properties
  const base = id.includes('[') ? id.slice(0, id.indexOf('[')) : id
  return _registry.get(base)
}

/** Blocks grouped by namespace for the palette UI */
export function getBlocksByNamespace(): Map<string, BlockEntry[]> {
  const groups = new Map<string, BlockEntry[]>()
  for (const entry of _registry.values()) {
    const list = groups.get(entry.namespace) ?? []
    list.push(entry)
    groups.set(entry.namespace, list)
  }
  return groups
}
