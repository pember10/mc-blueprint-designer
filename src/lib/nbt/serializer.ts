/**
 * Structurize .blueprint NBT v1 serializer.
 *
 * Converts the internal Blueprint model back to a gzip-compressed NBT binary.
 * We use `unknown` casts throughout because prismarine-nbt's typings are
 * stricter than the runtime API requires for nested compound values.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { writeUncompressed, type NBT } from 'prismarine-nbt'
import { gzip } from 'pako'
import type { Blueprint } from '@/lib/blueprint/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function packBlocks(structure: number[][][], sX: number, sY: number, sZ: number): number[] {
  const shorts: number[] = []
  for (let y = 0; y < sY; y++) {
    for (let z = 0; z < sZ; z++) {
      for (let x = 0; x < sX; x++) {
        shorts.push(structure[y]?.[z]?.[x] ?? 0)
      }
    }
  }
  // Pack pairs of shorts into ints
  const ints: number[] = []
  for (let i = 0; i < shorts.length; i += 2) {
    const hi = shorts[i] ?? 0
    const lo = shorts[i + 1] ?? 0
    ints.push(((hi & 0xffff) << 16) | (lo & 0xffff))
  }
  return ints
}

// Shorthand wrappers — typed loosely to avoid fighting prismarine-nbt's narrow types
type AnyNBT = unknown

function str(v: string): AnyNBT { return { type: 'string', value: v } }
function byte(v: number): AnyNBT { return { type: 'byte', value: v } }
function short(v: number): AnyNBT { return { type: 'short', value: v } }
function int(v: number): AnyNBT { return { type: 'int', value: v } }
function intArray(v: number[]): AnyNBT { return { type: 'intArray', value: v } }
function strList(vs: string[]): AnyNBT {
  return { type: 'list', value: { type: 'string', value: vs } }
}
function compoundList(vs: Record<string, AnyNBT>[]): AnyNBT {
  return { type: 'list', value: { type: 'compound', value: vs } }
}
function compound(v: Record<string, AnyNBT>): AnyNBT {
  return { type: 'compound', value: v }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialise a Blueprint back to a gzip-compressed .blueprint NBT binary.
 */
export function serializeBlueprint(bp: Blueprint): Uint8Array {
  // Build the palette NBT list
  const paletteList: Record<string, AnyNBT>[] = bp.palette.map((bs) => {
    const entry: Record<string, AnyNBT> = { Name: str(bs.name) }
    if (bs.properties && Object.keys(bs.properties).length > 0) {
      const props: Record<string, AnyNBT> = {}
      for (const [k, v] of Object.entries(bs.properties)) {
        props[k] = str(v)
      }
      entry['Properties'] = compound(props)
    }
    return entry
  })

  const teList: Record<string, AnyNBT>[] = bp.tileEntities.map((te) =>
    te.data as Record<string, AnyNBT>,
  )

  const entityList: Record<string, AnyNBT>[] = bp.entities.map((e) =>
    e.data as Record<string, AnyNBT>,
  )

  const blocks = packBlocks(bp.structure, bp.sizeX, bp.sizeY, bp.sizeZ)

  const root: NBT = {
    name: '',
    type: 'compound',
    value: {
      version: byte(1) as NBT,
      size_x: short(bp.sizeX) as NBT,
      size_y: short(bp.sizeY) as NBT,
      size_z: short(bp.sizeZ) as NBT,
      mcversion: int(bp.mcVersion) as NBT,
      required_mods: strList(bp.requiredMods) as NBT,
      palette: compoundList(paletteList) as NBT,
      blocks: intArray(blocks) as NBT,
      tile_entities: compoundList(teList) as NBT,
      entities: compoundList(entityList) as NBT,
      name: str(bp.meta.name) as NBT,
      architects: strList(bp.meta.architects) as NBT,
      optional_data: compound({
        structurize: compound({
          primary_offset: compound({
            X: int(bp.meta.primaryOffset.x),
            Y: int(bp.meta.primaryOffset.y),
            Z: int(bp.meta.primaryOffset.z),
          }),
        }),
      }) as NBT,
    },
  }

  const uncompressed = writeUncompressed(root)
  return gzip(uncompressed)
}
