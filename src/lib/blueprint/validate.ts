/**
 * Blueprint validation rules for MineColonies / Structurize blueprints.
 */

import type { Blueprint } from './types'
import { getBlock } from '@/lib/blocks/registry'
import { BUILDINGS } from '@/lib/minecolonies/buildings'

export type Severity = 'error' | 'warning' | 'info'

export interface Issue {
  id: string
  severity: Severity
  message: string
  detail?: string
}

// Namespaces shipped with the supporting mods — not "unknown"
const KNOWN_NAMESPACES = new Set([
  'minecraft',
  'structurize',
  'minecolonies',
  'domum_ornamentum',
])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run all validation checks and return a list of issues. */
export function validateBlueprint(bp: Blueprint, ghost?: Blueprint | null): Issue[] {
  const issues: Issue[] = []

  // -- Info: size + block count --
  let blockCount = 0
  for (let y = 0; y < bp.sizeY; y++)
    for (let z = 0; z < bp.sizeZ; z++)
      for (let x = 0; x < bp.sizeX; x++)
        if ((bp.structure[y]?.[z]?.[x] ?? 0) !== 0) blockCount++

  issues.push({
    id: 'size',
    severity: 'info',
    message: `${bp.sizeX} × ${bp.sizeY} × ${bp.sizeZ} blocks`,
    detail: `${blockCount.toLocaleString()} non-air blocks placed`,
  })

  // -- Error: footprint mismatch with ghost --
  if (ghost && (ghost.sizeX !== bp.sizeX || ghost.sizeZ !== bp.sizeZ)) {
    issues.push({
      id: 'footprint',
      severity: 'error',
      message: 'XZ footprint mismatch with ghost level',
      detail:
        `Active ${bp.sizeX}×${bp.sizeZ} vs ghost ${ghost.sizeX}×${ghost.sizeZ}. ` +
        `MineColonies requires identical XZ footprints across all hut levels.`,
    })
  }

  // -- Warning: unknown block namespaces --
  const unknownNs = new Set<string>()
  const unknownBlocks: string[] = []

  for (const bs of bp.palette) {
    if (!bs?.name || bs.name === 'minecraft:air') continue
    const ns = bs.name.split(':')[0]
    if (!KNOWN_NAMESPACES.has(ns)) {
      unknownNs.add(ns)
      if (!getBlock(bs.name)) unknownBlocks.push(bs.name)
    }
  }

  if (unknownNs.size > 0) {
    issues.push({
      id: 'unknown-ns',
      severity: 'warning',
      message: `Unknown namespaces: ${[...unknownNs].join(', ')}`,
      detail: `${unknownBlocks.length} block(s) have no registry entry. Import a resource pack to display textures.`,
    })
  }

  // -- Error: primary offset out of bounds --
  const { x: ox, y: oy, z: oz } = bp.meta.primaryOffset
  if (ox < 0 || oy < 0 || oz < 0 || ox >= bp.sizeX || oy >= bp.sizeY || oz >= bp.sizeZ) {
    issues.push({
      id: 'anchor-oob',
      severity: 'error',
      message: 'Anchor is outside blueprint bounds',
      detail: `Offset (${ox},${oy},${oz}) must be within (0–${bp.sizeX - 1}, 0–${bp.sizeY - 1}, 0–${bp.sizeZ - 1}).`,
    })
  }

  // -- Warning: requiredMod listed but no blocks from that mod in palette --
  const paletteNs = new Set(
    bp.palette.map((bs) => bs?.name?.split(':')[0]).filter(Boolean),
  )
  for (const mod of bp.requiredMods) {
    const modNs = mod.includes(':') ? mod.split(':')[0] : mod
    if (!paletteNs.has(modNs) && !paletteNs.has(mod)) {
      issues.push({
        id: `req-mod-${mod}`,
        severity: 'warning',
        message: `Required mod "${mod}" unused`,
        detail: 'Listed in requiredMods but no blocks from this mod appear in the palette.',
      })
    }
  }

  // -- Warning: empty blueprint --
  if (blockCount === 0) {
    issues.push({
      id: 'empty',
      severity: 'warning',
      message: 'Blueprint is empty',
      detail: 'No non-air blocks have been placed yet.',
    })
  }

  // -- Warning: missing hut block --
  if (bp.meta.name) {
    const building = BUILDINGS.find((b) => b.name === bp.meta.name)
    if (building) {
      const expectedBlock = `minecolonies:blockhut${building.hutId}`
      const paletteNames = bp.palette.map((bs) => bs?.name ?? '')
      const hasHutBlock = paletteNames.some((n) => {
        const base = n.includes('[') ? n.slice(0, n.indexOf('[')) : n
        return base === expectedBlock
      })
      if (!hasHutBlock) {
        issues.push({
          id: 'missing-hut-block',
          severity: 'warning',
          message: `Missing hut block: ${expectedBlock}`,
          detail: `MineColonies requires a "${expectedBlock}" block to be placed in this blueprint for the colony to recognise it as a ${building.name}.`,
        })
      }
    }
  }

  return issues
}

/**
 * Returns all non-vanilla namespaces found in the palette.
 * Used by the MissingModsBanner to decide whether to render.
 */
export function getUnknownNamespaces(bp: Blueprint): string[] {
  const found = new Set<string>()
  for (const bs of bp.palette) {
    if (!bs?.name) continue
    const ns = bs.name.split(':')[0]
    if (!KNOWN_NAMESPACES.has(ns) && ns !== '') found.add(ns)
  }
  return [...found]
}
