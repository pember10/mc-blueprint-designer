/**
 * Texture resolver — priority chain:
 *   1. User-provided resource packs (IndexedDB cache)
 *   2. Placeholder (colored canvas fallback)
 *
 * Textures are 16×16 PNG data URLs keyed by block ID.
 * Phase 3 (texture atlas / Faithful) will slot in here.
 */

import { openDB } from 'idb'
import JSZip from 'jszip'
import { getBlock } from './registry'

const DB_NAME = 'mc-blueprint-textures'
const STORE_NAME = 'textures'

// In-memory cache: blockId → data URL
const memCache = new Map<string, string>()

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME)
    },
  })
}

async function dbGet(key: string): Promise<string | undefined> {
  try {
    const db = await getDb()
    return db.get(STORE_NAME, key)
  } catch {
    return undefined
  }
}

async function dbPut(key: string, value: string): Promise<void> {
  try {
    const db = await getDb()
    await db.put(STORE_NAME, value, key)
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Placeholder generator
// ---------------------------------------------------------------------------

function makePlaceholder(color: string, size = 16): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  // Checkerboard for transparent / unknown
  if (color === 'unknown') {
    ctx.fillStyle = '#cc44cc'
    ctx.fillRect(0, 0, 8, 8)
    ctx.fillRect(8, 8, 8, 8)
    ctx.fillStyle = '#000000'
    ctx.fillRect(8, 0, 8, 8)
    ctx.fillRect(0, 8, 8, 8)
  }
  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
// Resource pack import
// ---------------------------------------------------------------------------

/** Load textures from a resource pack ZIP file into IndexedDB */
export async function importResourcePack(file: File): Promise<number> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  let count = 0

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    // Match: assets/<modid>/textures/block/<name>.png
    const match = path.match(/^assets\/([^/]+)\/textures\/block\/(.+)\.png$/)
    if (!match) continue
    const [, modId, texName] = match
    const key = `${modId}:${texName}`

    const blob = await zipEntry.async('blob')
    const dataUrl = await blobToDataUrl(blob)
    memCache.set(key, dataUrl)
    await dbPut(key, dataUrl)
    count++
  }

  return count
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

// ---------------------------------------------------------------------------
// Primary resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a texture data URL for a block ID.
 * Returns immediately from memory cache; falls back to IndexedDB then placeholder.
 */
export async function resolveTexture(blockId: string): Promise<string> {
  // Air is always transparent
  if (blockId === 'minecraft:air') return makePlaceholder('#00000000')

  // Memory cache
  if (memCache.has(blockId)) return memCache.get(blockId)!

  // Extract texture name from block ID (e.g. "minecraft:oak_planks" → "oak_planks")
  const texName = blockId.split(':')[1] ?? blockId

  // IndexedDB check
  const cached = await dbGet(blockId) ?? await dbGet(texName)
  if (cached) {
    memCache.set(blockId, cached)
    return cached
  }

  // Placeholder from registry color
  const entry = getBlock(blockId)
  const color = entry?.color ?? 'unknown'
  const placeholder = makePlaceholder(color)
  memCache.set(blockId, placeholder)
  return placeholder
}

/**
 * Synchronous fallback for use in render loops.
 * Always returns a CSS hex color string from the block registry.
 * (Never returns data URLs — use textureMap in editorStore for that.)
 */
export function resolveColorSync(blockId: string): string {
  const entry = getBlock(blockId)
  return entry?.color ?? '#888888'
}

/**
 * Returns all data-URL entries currently in the memory cache.
 * Call this after importResourcePack() to populate editorStore.textureMap.
 */
export function getMemCacheSnapshot(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of memCache.entries()) {
    if (v.startsWith('data:')) out[k] = v
  }
  return out
}
