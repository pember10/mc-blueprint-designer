/**
 * Texture resolver — priority chain:
 *   1. Memory cache (instant)
 *   2. IndexedDB (user-imported resource pack or JAR)
 *   3. jsDelivr CDN (InventivetalentDev/minecraft-assets, cached to IDB after first fetch)
 *   4. Placeholder (colored canvas fallback)
 *
 * Vanilla block models/textures load automatically from CDN with no user action.
 * Import a resource pack or JAR to override with custom textures or add mod support.
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
// blockId → texId map (persisted to localStorage)
// Maps e.g. "minecraft:lava" → "block/lava_still" so AnimatedBlockIcon can
// fetch the correct .mcmeta frame sequence for blocks resolved via the
// blockstate→model pipeline rather than a direct CDN name match.
// ---------------------------------------------------------------------------

const BLOCK_TO_TEX_ID_KEY = 'mc-blueprint-block-texid'

const blockToTexId = new Map<string, string>(
  (() => {
    try {
      const s = localStorage.getItem(BLOCK_TO_TEX_ID_KEY)
      return s ? (JSON.parse(s) as [string, string][]) : []
    } catch { return [] }
  })(),
)

export function getBlockTexId(blockId: string): string | undefined {
  return blockToTexId.get(blockId)
}

let _texIdSavePending = false
export function setBlockTexId(blockId: string, texId: string): void {
  blockToTexId.set(blockId, texId)
  if (_texIdSavePending) return
  _texIdSavePending = true
  Promise.resolve().then(() => {
    _texIdSavePending = false
    try { localStorage.setItem(BLOCK_TO_TEX_ID_KEY, JSON.stringify([...blockToTexId])) } catch { /* quota */ }
  })
}

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

/**
 * Store a data URL in IDB and memCache under an arbitrary key.
 * Used by the preloader to persist blockId-keyed entries so getAllCachedTextures
 * can restore them on subsequent page loads.
 */
export async function cacheTexture(key: string, dataUrl: string): Promise<void> {
  if (memCache.get(key) === dataUrl) return
  memCache.set(key, dataUrl)
  try {
    const db = await getDb()
    await db.put(STORE_NAME, dataUrl, key)
  } catch { /* quota — ignore */ }
}

/**
 * Bulk-read all cached texture data URLs from IDB into memory.
 * Used on page reload to silently restore textureMap without re-fetching the CDN.
 * Also warms the in-memory cache so subsequent lookups are instant.
 */
export async function getAllCachedTextures(): Promise<Record<string, string>> {
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const [keys, values] = await Promise.all([
      tx.store.getAllKeys() as Promise<string[]>,
      tx.store.getAll() as Promise<string[]>,
    ])
    const map: Record<string, string> = {}
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      const v = values[i]
      if (k && v) {
        map[k] = v
        memCache.set(k, v)
      }
    }
    return map
  } catch {
    return {}
  }
}

export async function getBlockstateJson(key: string): Promise<unknown | null> {
  if (bsMemCache.has(key)) return bsMemCache.get(key)!
  try {
    const db = await getDb()
    const raw: string | undefined = await db.get(BLOCKSTATES_STORE, key)
    if (raw) {
      const parsed = JSON.parse(raw)
      bsMemCache.set(key, parsed)
      return parsed
    }
  } catch { /* fall through to CDN */ }
  return fetchBlockstateFromCdn(key)
}

export async function getModelJson(key: string): Promise<unknown | null> {
  if (modelMemCache.has(key)) return modelMemCache.get(key)!
  try {
    const db = await getDb()
    const raw: string | undefined = await db.get(MODELS_STORE, key)
    if (raw) {
      const parsed = JSON.parse(raw)
      modelMemCache.set(key, parsed)
      return parsed
    }
  } catch { /* fall through to CDN */ }
  return fetchModelFromCdn(key)
}

export function clearBlockModelCaches(): void {
  bsMemCache.clear()
  modelMemCache.clear()
}

// ---------------------------------------------------------------------------
// CDN fallback (InventivetalentDev/minecraft-assets via jsDelivr)
// ---------------------------------------------------------------------------

/** Minecraft version tag used for CDN asset lookups. Change to match your target version. */
export let cdnVersion = '1.21.4'
export function setCdnVersion(v: string) { cdnVersion = v }

function cdnUrl(namespace: string, type: string, path: string, ext: string): string {
  return `https://assets.mcasset.cloud/${cdnVersion}/assets/${namespace}/${type}/${path}.${ext}`
}

/** Fetch blockstate JSON from CDN and persist to IDB. Returns null on failure. */
async function fetchBlockstateFromCdn(key: string): Promise<unknown | null> {
  const colon = key.indexOf(':')
  const namespace = colon !== -1 ? key.slice(0, colon) : 'minecraft'
  const name = colon !== -1 ? key.slice(colon + 1) : key
  try {
    const res = await fetch(cdnUrl(namespace, 'blockstates', name, 'json'))
    if (!res.ok) return null
    const text = await res.text()
    const parsed = JSON.parse(text)
    bsMemCache.set(key, parsed)
    const db = await getDb()
    await db.put(BLOCKSTATES_STORE, text, key)
    return parsed
  } catch { return null }
}

/** Fetch model JSON from CDN and persist to IDB. Returns null on failure. */
async function fetchModelFromCdn(key: string): Promise<unknown | null> {
  const colon = key.indexOf(':')
  const namespace = colon !== -1 ? key.slice(0, colon) : 'minecraft'
  const path = colon !== -1 ? key.slice(colon + 1) : key
  try {
    const res = await fetch(cdnUrl(namespace, 'models', path, 'json'))
    if (!res.ok) return null
    const text = await res.text()
    const parsed = JSON.parse(text)
    modelMemCache.set(key, parsed)
    const db = await getDb()
    await db.put(MODELS_STORE, text, key)
    return parsed
  } catch { return null }
}

/** Crop an animated sprite-sheet data URL to its first frame. Non-animated images pass through unchanged. */
function cropFirstFrame(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight
      if (h <= w || h % w !== 0) { resolve(dataUrl); return }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = w
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, w, 0, 0, w, w)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Fetch a block texture PNG from CDN, convert to data URL, persist to IDB. Returns null on failure. */
async function fetchTextureFromCdn(blockId: string): Promise<string | null> {
  const colon = blockId.indexOf(':')
  const namespace = colon !== -1 ? blockId.slice(0, colon) : 'minecraft'
  const name = colon !== -1 ? blockId.slice(colon + 1) : blockId
  // Texture IDs can be "block/oak_planks" or just "oak_planks"
  const path = name.includes('/') ? name : `block/${name}`
  try {
    const res = await fetch(cdnUrl(namespace, 'textures', path, 'png'))
    if (!res.ok) return null
    const dataUrl = await blobToDataUrl(await res.blob())
    memCache.set(blockId, dataUrl)
    const db = await getDb()
    await db.put(STORE_NAME, dataUrl, blockId)
    return dataUrl
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Animated texture metadata (mcmeta)
// ---------------------------------------------------------------------------

export interface McmetaAnimation {
  /** Explicit frame sequence; each entry is a row index or {index, time} object. */
  frames?: (number | { index: number; time?: number })[]
  /** Ticks per frame (1 tick = 50 ms). Defaults to 1. */
  frametime?: number
  interpolate?: boolean
}

/**
 * Fetch the `.mcmeta` animation data for a texture ID such as
 * `"minecraft:block/lava_still"`.  Returns null if the texture has no mcmeta
 * (i.e. it is not animated or the CDN doesn't have one).
 *
 * Note from minecraft-renderer (zardoy): that library handles animated textures
 * by updating atlas pixel regions each tick rather than per-texture offsets.
 * We use the simpler per-texture repeat/offset approach, but mcmeta frame data
 * (e.g. lava's ping-pong sequence) must still be respected.
 */
export async function fetchTextureMcmeta(texId: string): Promise<McmetaAnimation | null> {
  const colon = texId.indexOf(':')
  const namespace = colon !== -1 ? texId.slice(0, colon) : 'minecraft'
  const name = colon !== -1 ? texId.slice(colon + 1) : texId
  const path = name.includes('/') ? name : `block/${name}`
  try {
    const res = await fetch(cdnUrl(namespace, 'textures', path, 'png.mcmeta'))
    if (!res.ok) return null
    const json = await res.json() as { animation?: McmetaAnimation }
    return json.animation ?? null
  } catch { return null }
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
 * Like resolveTexture but returns null instead of a placeholder when the
 * texture cannot be found. Used by the palette preloader so failed fetches
 * leave the palette showing the registry color rather than a grey square.
 */
export async function tryResolveTexture(blockId: string): Promise<string | null> {
  let url: string | null = null
  if (memCache.has(blockId)) {
    url = memCache.get(blockId)!
  } else {
    try {
      const db = await getDb()
      const raw: string | undefined = await db.get(STORE_NAME, blockId)
      if (raw) { memCache.set(blockId, raw); url = raw }
    } catch { /* fall through */ }
    if (!url) url = await fetchTextureFromCdn(blockId)
  }
  // Crop animated sprite-sheets to their first frame for palette icons
  return url ? cropFirstFrame(url) : null
}

/**
 * Resolve a texture by its model-path texture ID (e.g. "minecraft:block/stone").
 * Uses the same CDN/IDB/memCache chain as resolveTexture.
 */
export async function resolveTextureById(texId: string): Promise<string> {
  if (memCache.has(texId)) return memCache.get(texId)!
  try {
    const db = await getDb()
    const raw: string | undefined = await db.get(STORE_NAME, texId)
    if (raw) { memCache.set(texId, raw); return raw }
  } catch { /* fall through to CDN */ }
  const cdn = await fetchTextureFromCdn(texId)
  if (cdn) return cdn
  // Last resort: placeholder
  return makePlaceholder('#888888')
}

/**
 * Resolve a texture data URL for a block ID.
 * Returns immediately from memory cache; falls back to IndexedDB then CDN then placeholder.
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

  // CDN fallback (tries both "namespace:name" and "namespace:block/name" forms)
  const cdnResult = await fetchTextureFromCdn(blockId)
  if (cdnResult) return cdnResult

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
  // 'transparent' signals that the block has no registered opaque color
  // (cross-model sprites like flowers, torches, etc.). Callers must handle
  // this gracefully — do not pass it to THREE.Color or fillRect.
  return entry?.color ?? 'transparent'
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
