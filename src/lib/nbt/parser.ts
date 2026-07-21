/**
 * Structurize .blueprint NBT v1 parser.
 *
 * Wire format (gzip-compressed NBT compound):
 *   version        : byte  (must be 1)
 *   size_x/y/z     : short
 *   mcversion      : int
 *   required_mods  : list<string>
 *   palette        : list<compound { Name: string, Properties?: compound }>
 *   blocks         : int[]  — pairs of shorts packed as (hi << 16 | lo),
 *                            iterated [y][z][x]
 *   tile_entities  : list<compound>  (each has x,y,z shorts)
 *   entities       : list<compound>  (each has Pos: list<double>)
 *   name           : string (optional)
 *   architects     : list<string> (optional)
 *   optional_data  : compound {
 *     structurize  : compound { primary_offset: compound { X,Y,Z: int } }
 *   }
 */

import { parse as parseNbt } from 'prismarine-nbt'
import { inflate } from 'pako'
import type { Blueprint, BlockState, TileEntity, EntityData } from '@/lib/blueprint/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unpackBlocks(ints: number[], sX: number, sY: number, sZ: number): number[][][] {
  // Each int contains two shorts: high 16 bits = first index, low 16 bits = second
  const shorts: number[] = []
  for (const i of ints) {
    shorts.push((i >> 16) & 0xffff)
    shorts.push(i & 0xffff)
  }
  // Build structure[y][z][x]
  const structure: number[][][] = Array.from({ length: sY }, () =>
    Array.from({ length: sZ }, () => new Array<number>(sX).fill(0)),
  )
  let idx = 0
  for (let y = 0; y < sY; y++) {
    for (let z = 0; z < sZ; z++) {
      for (let x = 0; x < sX; x++) {
        structure[y][z][x] = shorts[idx++] ?? 0
      }
    }
  }
  return structure
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nbtValue(node: any): unknown {
  if (node === null || node === undefined) return null
  if (typeof node === 'object' && 'value' in node) return nbtValue(node.value)
  if (Array.isArray(node)) return node.map(nbtValue)
  return node
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getString(node: any, fallback = ''): string {
  const v = nbtValue(node)
  return typeof v === 'string' ? v : fallback
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNumber(node: any, fallback = 0): number {
  const v = nbtValue(node)
  return typeof v === 'number' ? v : fallback
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getList(node: any): any[] {
  const v = nbtValue(node)
  return Array.isArray(v) ? v : []
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a .blueprint file (ArrayBuffer) into the internal Blueprint model.
 * Throws if the data is invalid or an unsupported version.
 */
export async function parseBlueprint(buffer: ArrayBuffer): Promise<Blueprint> {
  // Decompress (gzip)
  const decompressed = inflate(new Uint8Array(buffer))

  // Parse NBT
  const { parsed } = await parseNbt(Buffer.from(decompressed))
  // prismarine-nbt wraps the root in { name, value }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root: any = (parsed as any).value ?? parsed

  const version = getNumber(root.version, -1)
  if (version !== 1) {
    throw new Error(`Unsupported blueprint version: ${version}`)
  }

  const sizeX = getNumber(root.size_x)
  const sizeY = getNumber(root.size_y)
  const sizeZ = getNumber(root.size_z)
  const mcVersion = getNumber(root.mcversion, 3700)

  // Required mods
  const requiredMods: string[] = getList(root.required_mods).map((m) =>
    typeof m === 'string' ? m : getString(m),
  )

  // Palette
  const paletteList = getList(root.palette)
  const palette: BlockState[] = paletteList.map((entry) => {
    const name = getString((entry as Record<string, unknown>)?.Name ?? (entry as Record<string, unknown>)?.name, 'minecraft:air')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propsRaw = (entry as any)?.Properties ?? (entry as any)?.properties
    const properties: Record<string, string> = {}
    if (propsRaw && typeof propsRaw === 'object' && !Array.isArray(propsRaw)) {
      for (const [k, v] of Object.entries(propsRaw as Record<string, unknown>)) {
        properties[k] = getString(v as never, String(v))
      }
    }
    return Object.keys(properties).length > 0 ? { name, properties } : { name }
  })

  // Ensure air at index 0
  if (palette.length === 0 || palette[0].name !== 'minecraft:air') {
    palette.unshift({ name: 'minecraft:air' })
  }

  // Blocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocksRaw: any = nbtValue(root.blocks)
  const ints: number[] = Array.isArray(blocksRaw) ? (blocksRaw as number[]) : []
  const structure = unpackBlocks(ints, sizeX, sizeY, sizeZ)

  // Tile entities
  const tileEntities: TileEntity[] = getList(root.tile_entities).map((te) => {
    const rec = te as Record<string, unknown>
    return {
      x: getNumber(rec.x),
      y: getNumber(rec.y),
      z: getNumber(rec.z),
      data: rec as Record<string, unknown>,
    }
  })

  // Entities
  const entities: EntityData[] = getList(root.entities).map((e) => {
    const rec = e as Record<string, unknown>
    const posList = getList(rec.Pos ?? rec.pos)
    const pos: [number, number, number] = [
      getNumber(posList[0]),
      getNumber(posList[1]),
      getNumber(posList[2]),
    ]
    return { pos, data: rec }
  })

  // Optional data → primary offset
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optData = (root.optional_data as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const structurizeData = optData?.structurize ?? optData?.value?.structurize
  const offsetRaw = structurizeData?.primary_offset ?? structurizeData?.value?.primary_offset
  const primaryOffset = {
    x: getNumber(offsetRaw?.X ?? offsetRaw?.value?.X),
    y: getNumber(offsetRaw?.Y ?? offsetRaw?.value?.Y),
    z: getNumber(offsetRaw?.Z ?? offsetRaw?.value?.Z),
  }

  const name = getString(root.name)
  const architects: string[] = getList(root.architects).map((a) =>
    typeof a === 'string' ? a : getString(a),
  )

  return {
    palette,
    structure,
    sizeX,
    sizeY,
    sizeZ,
    tileEntities,
    entities,
    requiredMods,
    mcVersion,
    meta: {
      name,
      fileName: '',
      packName: '',
      primaryOffset,
      architects,
    },
  }
}
