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
const DB_VERSION = 2
const STORE_NAME = 'textures'
const BLOCKSTATES_STORE = 'blockstates'
const MODELS_STORE = 'models'

// In-memory cache: blockId → data URL
const memCache = new Map<string, string>()
// In-memory cache for parsed JSON (avoids repeated IDB reads)
const bsMemCache = new Map<string, unknown>()
const modelMemCache = new Map<string, unknown>()

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore(STORE_NAME)
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(BLOCKSTATES_STORE)) db.createObjectStore(BLOCKSTATES_STORE)
        if (!db.objectStoreNames.contains(MODELS_STORE)) db.createObjectStore(MODELS_STORE)
      }
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

export async function getBlockstateJson(key: string): Promise<unknown | null> {
  if (bsMemCache.has(key)) return bsMemCache.get(key)!
  try {
    const db = await getDb()
    const raw: string | undefined = await db.get(BLOCKSTATES_STORE, key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    bsMemCache.set(key, parsed)
    return parsed
  } catch { return null }
}

export async function getModelJson(key: string): Promise<unknown | null> {
  if (modelMemCache.has(key)) return modelMemCache.get(key)!
  try {
    const db = await getDb()
    const raw: string | undefined = await db.get(MODELS_STORE, key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    modelMemCache.set(key, parsed)
    return parsed
  } catch { return null }
}

export function clearBlockModelCaches(): void {
  bsMemCache.clear()
  modelMemCache.clear()
}

// ---------------------------------------------------------------------------
// JAR / resource-pack import helpers
// ---------------------------------------------------------------------------

async function ingestZip(
  zip: JSZip,
  onProgress?: (msg: string) => void,
): Promise<{ textures: number; blockstates: number; models: number }> {
  let textures = 0, blockstates = 0, models = 0
  const db = await getDb()

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue

    const texMatch = path.match(/^assets\/([^/]+)\/textures\/block\/(.+)\.png$/)
    if (texMatch) {
      const key = `${texMatch[1]}:${texMatch[2]}`
      const blob = await entry.async('blob')
      const dataUrl = await blobToDataUrl(blob)
      memCache.set(key, dataUrl)
      await db.put(STORE_NAME, dataUrl, key)
      textures++
      continue
    }

    const bsMatch = path.match(/^assets\/([^/]+)\/blockstates\/(.+)\.json$/)
    if (bsMatch) {
      const key = `${bsMatch[1]}:${bsMatch[2]}`
      const text = await entry.async('text')
      bsMemCache.set(key, JSON.parse(text))
      await db.put(BLOCKSTATES_STORE, text, key)
      blockstates++
      continue
    }

    const modelMatch = path.match(/^assets\/([^/]+)\/models\/(.+)\.json$/)
    if (modelMatch) {
      const key = `${modelMatch[1]}:${modelMatch[2]}`
      const text = await entry.async('text')
      modelMemCache.set(key, JSON.parse(text))
      await db.put(MODELS_STORE, text, key)
      models++
      continue
    }
  }

  if (onProgress) onProgress(`Loaded ${textures} textures, ${blockstates} blockstates, ${models} models`)
  return { textures, blockstates, models }
}

/** Import a vanilla Minecraft .jar (or any resource pack ZIP containing block assets). */
export async function importMinecraftJar(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<{ textures: number; blockstates: number; models: number }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  return ingestZip(zip, onProgress)
}

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

/** Load textures (and optionally block models) from a resource pack ZIP file into IndexedDB */
export async function importResourcePack(file: File): Promise<number> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const { textures } = await ingestZip(zip)
  return textures
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
