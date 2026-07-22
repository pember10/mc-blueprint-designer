export type BuildingCategory =
  | 'CORE'
  | 'PRODUCTION & CRAFTING'
  | 'FOOD & HOSPITALITY'
  | 'ANIMALS'
  | 'MILITARY & DEFENCE'
  | 'EDUCATION & RESEARCH'
  | 'UTILITY & SPECIAL'

export interface BuildingDef {
  /** Display name */
  name: string
  /** hutId suffix — minecolonies:blockhut{hutId} */
  hutId: string
  /** Visual category for grouping in Pack Buildings tab */
  category: BuildingCategory
  /** Required for a functional colony */
  required: boolean
  /** Short description shown on hover */
  desc: string
  /** Two-letter mono icon shown when no blueprint exists */
  mono: string
}

export const BUILDINGS: BuildingDef[] = [
  // ──── CORE ────────────────────────────────────────────────────────────────
  {
    name: 'Town Hall',
    hutId: 'townhall',
    category: 'CORE',
    required: true,
    desc: 'The founding building — placed first to claim colony land and manage citizens.',
    mono: 'TH',
  },
  {
    name: "Builder's Hut",
    hutId: 'builder',
    category: 'CORE',
    required: true,
    desc: 'Required for all construction. Builders live here and carry out every build order.',
    mono: 'BU',
  },
  {
    name: 'Residence',
    hutId: 'citizen',
    category: 'CORE',
    required: true,
    desc: 'Housing for citizens. Citizens cannot be added to the colony without beds.',
    mono: 'RE',
  },
  {
    name: 'Warehouse',
    hutId: 'warehouse',
    category: 'CORE',
    required: true,
    desc: 'Central storage hub. All colony resources flow through here.',
    mono: 'WH',
  },
  {
    name: "Courier's Hut",
    hutId: 'deliveryman',
    category: 'CORE',
    required: true,
    desc: 'Transports items between the Warehouse and all other huts. Required for logistics.',
    mono: 'CO',
  },

  // ──── PRODUCTION & CRAFTING ───────────────────────────────────────────────
  {
    name: 'Sawmill',
    hutId: 'sawmill',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Produces wooden planks, stairs, slabs, and other wood products.',
    mono: 'SW',
  },
  {
    name: 'Stonemason',
    hutId: 'stonemason',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Cuts and crafts stone, stone bricks, and related decorative stone blocks.',
    mono: 'SM',
  },
  {
    name: 'Blacksmith',
    hutId: 'blacksmith',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Smelts and crafts iron and gold tools, armor, and equipment.',
    mono: 'BS',
  },
  {
    name: 'Smeltery',
    hutId: 'smeltery',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Smelts ores into ingots and processes metal resources.',
    mono: 'SL',
  },
  {
    name: 'Stone Smeltery',
    hutId: 'stonesmeltery',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Produces smooth stone, glass, and other heat-processed stone goods.',
    mono: 'SS',
  },
  {
    name: 'Mechanic',
    hutId: 'mechanic',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Crafts complex mechanical and redstone components.',
    mono: 'MC',
  },
  {
    name: 'Fletcher',
    hutId: 'fletcher',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Crafts bows, arrows, crossbows, and fishing rods.',
    mono: 'FL',
  },
  {
    name: 'Dyer',
    hutId: 'dyer',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Produces dye and dyed wool, terracotta, and glass.',
    mono: 'DY',
  },
  {
    name: 'Glassblower',
    hutId: 'glassblower',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Crafts glass panes, bottles, and glass-based items.',
    mono: 'GB',
  },
  {
    name: 'Concrete Mixer',
    hutId: 'concretemixer',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Produces concrete powder and concrete blocks.',
    mono: 'CM',
  },
  {
    name: 'Crusher',
    hutId: 'crusher',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Grinds blocks down into smaller components (gravel → sand, etc.).',
    mono: 'CR',
  },
  {
    name: 'Sifter',
    hutId: 'sifter',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Sifts gravel, sand, dirt, and soul sand for drops (flint, clay, etc.).',
    mono: 'SF',
  },
  {
    name: 'Composter',
    hutId: 'composter',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Converts organic material into bone meal and compost.',
    mono: 'CP',
  },
  {
    name: 'Plantation',
    hutId: 'plantation',
    category: 'PRODUCTION & CRAFTING',
    required: false,
    desc: 'Grows specialty crops: sugar cane, cactus, bamboo, cocoa beans, etc.',
    mono: 'PL',
  },

  // ──── FOOD & HOSPITALITY ──────────────────────────────────────────────────
  {
    name: 'Baker',
    hutId: 'baker',
    category: 'FOOD & HOSPITALITY',
    required: false,
    desc: 'Bakes bread and other food items from wheat.',
    mono: 'BA',
  },
  {
    name: 'Cook (Restaurant)',
    hutId: 'cook',
    category: 'FOOD & HOSPITALITY',
    required: false,
    desc: 'Feeds colonists. Cooks meals from raw ingredients stored in the Warehouse.',
    mono: 'CK',
  },
  {
    name: 'Farmer',
    hutId: 'farmer',
    category: 'FOOD & HOSPITALITY',
    required: false,
    desc: 'Grows wheat, potatoes, carrots, beets, and other farmland crops.',
    mono: 'FA',
  },
  {
    name: 'Fisherman',
    hutId: 'fisherman',
    category: 'FOOD & HOSPITALITY',
    required: false,
    desc: 'Catches fish and aquatic drops.',
    mono: 'FI',
  },
  {
    name: 'Tavern',
    hutId: 'tavern',
    category: 'FOOD & HOSPITALITY',
    required: false,
    desc: 'Provides housing for up to 4 citizens and generates happiness in the colony.',
    mono: 'TV',
  },

  // ──── ANIMALS ─────────────────────────────────────────────────────────────
  {
    name: 'Cowherder',
    hutId: 'cowherder',
    category: 'ANIMALS',
    required: false,
    desc: 'Raises cows for beef and leather.',
    mono: 'CW',
  },
  {
    name: 'Swineherder',
    hutId: 'swineherder',
    category: 'ANIMALS',
    required: false,
    desc: 'Raises pigs for pork and other drops.',
    mono: 'SW',
  },
  {
    name: 'Shepherd',
    hutId: 'shepherd',
    category: 'ANIMALS',
    required: false,
    desc: 'Raises sheep for wool and mutton.',
    mono: 'SH',
  },
  {
    name: 'Chicken Coop',
    hutId: 'chickencoop',
    category: 'ANIMALS',
    required: false,
    desc: 'Raises chickens for eggs, feathers, and meat.',
    mono: 'CC',
  },
  {
    name: 'Rabbit Hutch',
    hutId: 'rabbithutch',
    category: 'ANIMALS',
    required: false,
    desc: "Raises rabbits for hides, meat, and rabbit's feet.",
    mono: 'RH',
  },
  {
    name: 'Beekeeper',
    hutId: 'beekeeper',
    category: 'ANIMALS',
    required: false,
    desc: 'Manages beehives for honey, honeycomb, and beeswax.',
    mono: 'BK',
  },

  // ──── MILITARY & DEFENCE ──────────────────────────────────────────────────
  {
    name: 'Guard Tower',
    hutId: 'guardtower',
    category: 'MILITARY & DEFENCE',
    required: false,
    desc: 'Houses a single guard who patrols a set route around the colony.',
    mono: 'GT',
  },
  {
    name: 'Barracks',
    hutId: 'barracks',
    category: 'MILITARY & DEFENCE',
    required: false,
    desc: 'A large military complex housing multiple guards and their equipment.',
    mono: 'BR',
  },
  {
    name: 'Barracks Tower',
    hutId: 'barrackstower',
    category: 'MILITARY & DEFENCE',
    required: false,
    desc: 'Attached to the Barracks; houses additional guards.',
    mono: 'BT',
  },
  {
    name: 'Archery',
    hutId: 'archery',
    category: 'MILITARY & DEFENCE',
    required: false,
    desc: 'Trains archer guards to use bows and crossbows.',
    mono: 'AR',
  },
  {
    name: 'Combat Academy',
    hutId: 'combatacademy',
    category: 'MILITARY & DEFENCE',
    required: false,
    desc: 'Trains knight guards in melee combat.',
    mono: 'CA',
  },

  // ──── EDUCATION & RESEARCH ────────────────────────────────────────────────
  {
    name: 'Library',
    hutId: 'library',
    category: 'EDUCATION & RESEARCH',
    required: false,
    desc: 'Citizens study here to improve their intelligence skill over time.',
    mono: 'LB',
  },
  {
    name: 'School',
    hutId: 'school',
    category: 'EDUCATION & RESEARCH',
    required: false,
    desc: 'Children attend school to learn skills before reaching working age.',
    mono: 'SC',
  },
  {
    name: 'University',
    hutId: 'university',
    category: 'EDUCATION & RESEARCH',
    required: false,
    desc: 'Researchers unlock colony upgrades and new technologies.',
    mono: 'UN',
  },

  // ──── UTILITY & SPECIAL ───────────────────────────────────────────────────
  {
    name: 'Miner',
    hutId: 'miner',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'Digs tunnels and mines for ores, stone, and minerals.',
    mono: 'MN',
  },
  {
    name: 'Lumberjack',
    hutId: 'lumberjack',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'Chops down trees and replants saplings automatically.',
    mono: 'LJ',
  },
  {
    name: 'Enchanter',
    hutId: 'enchanter',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'Enchants tools, armor, and books using accumulated XP from colonists.',
    mono: 'EN',
  },
  {
    name: 'Alchemist',
    hutId: 'alchemist',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'Brews potions and produces alchemical supplies.',
    mono: 'AL',
  },
  {
    name: 'Hospital',
    hutId: 'hospital',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'Heals injured or sick colonists.',
    mono: 'HP',
  },
  {
    name: 'Graveyard',
    hutId: 'graveyard',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'Stores the graves of colonists who have died. Can revive them over time.',
    mono: 'GY',
  },
  {
    name: 'Mystical Site',
    hutId: 'mysticalsite',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'A decorative building that boosts happiness in the surrounding colony area.',
    mono: 'MS',
  },
  {
    name: 'Nether Worker',
    hutId: 'netherworker',
    category: 'UTILITY & SPECIAL',
    required: false,
    desc: 'Travels to the Nether to gather Nether-specific resources.',
    mono: 'NW',
  },
]

/** All unique categories in display order */
export const BUILDING_CATEGORIES: BuildingCategory[] = [
  'CORE',
  'PRODUCTION & CRAFTING',
  'FOOD & HOSPITALITY',
  'ANIMALS',
  'MILITARY & DEFENCE',
  'EDUCATION & RESEARCH',
  'UTILITY & SPECIAL',
]

/** Look up a building by hutId */
export function getBuildingByHutId(hutId: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.hutId === hutId)
}

/** Slugify a building name to a filename prefix, e.g. "Builder's Hut" → "buildershut" */
export function slugifyBuilding(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}
