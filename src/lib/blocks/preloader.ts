/**
 * Vanilla block texture preloader.
 *
 * Loads a representative texture for every registered Minecraft block so
 * the palette can show pixel-art icons instead of plain colour swatches.
 *
 * Uses a two-step resolution strategy:
 *   1. Fast path: try the direct block-name texture (e.g. oak_planks → oak_planks.png)
 *   2. Slow path: blockstate → model → first texture ID (handles oak_wood → oak_log.png, etc.)
 *
 * All fetched textures are cached in IndexedDB, so after the first run
 * subsequent preloads read from IDB and complete in a second or two.
 */

import { getAllBlocks } from './registry'
import { tryResolveTexture, resolveTexture, resolveTextureById, cacheTexture, setBlockTexId } from './textures'
import { resolveBlockstate } from './blockstate'
import { resolveModel } from './model'

// Bump this when the block registry or preload logic changes in a way that
// requires a full re-fetch (clears the cached "done" flag in localStorage).
const PRELOAD_VERSION = 'v5'
const PRELOAD_DONE_KEY = `mc-blueprint-preload-${PRELOAD_VERSION}`

// Module-level flag: true for the lifetime of this page session once preload completes.
let _done = false

export function isPreloadDone(): boolean {
  if (_done) return true
  try { return localStorage.getItem(PRELOAD_DONE_KEY) === '1' } catch { return false }
}

/**
 * Resolve a palette icon texture for a block.
 * Returns a full sprite-sheet data URL, or null if nothing useful was found.
 */
async function resolveBlockIcon(blockId: string): Promise<string | null> {
  // Fast path: direct name match (works for most blocks, e.g. oak_planks)
  const direct = await tryResolveTexture(blockId)
  if (direct) {
    // Full sprite sheet is in memCache — resolveTexture is a cache-hit here
    return resolveTexture(blockId)
  }

  // Slow path: blockstate → model → first available texture
  // Handles blocks like oak_wood (texture = oak_log), slabs, etc.
  try {
    const variant = await resolveBlockstate(blockId)
    if (!variant) return null
    const model = await resolveModel(variant.modelId)
    if (!model) return null
    // Prefer particle (usually the top/side texture), then all, then first
    const texId =
      model.textures['particle'] ??
      model.textures['all'] ??
      model.textures['side'] ??
      model.textures['top'] ??
      Object.values(model.textures)[0]
    if (!texId) return null
    setBlockTexId(blockId, texId)
    const url = await resolveTextureById(texId)
    // Persist under the blockId key so getAllCachedTextures() can restore it on
    // subsequent page loads (resolveTextureById stores under texId, not blockId).
    await cacheTexture(blockId, url)
    return url
  } catch {
    return null
  }
}

/**
 * Preload textures for all vanilla Minecraft blocks.
 *
 * @param onProgress  Called after every individual block resolves.
 * @param onBatch     Called after each batch with the newly-resolved entries.
 *                    Merge these into editorStore.textureMap so the palette
 *                    updates progressively.
 */
export async function preloadAllTextures(
  onProgress: (loaded: number, total: number) => void,
  onBatch: (batch: Record<string, string>) => void,
): Promise<void> {
  if (_done) return

  const blocks = getAllBlocks().filter(
    (b) => b.id !== 'minecraft:air' && b.namespace === 'minecraft',
  )
  const total = blocks.length
  let loaded = 0

  const BATCH = 20
  for (let i = 0; i < blocks.length; i += BATCH) {
    const slice = blocks.slice(i, i + BATCH)
    const batchResult: Record<string, string> = {}
    await Promise.all(
      slice.map(async (b) => {
        const url = await resolveBlockIcon(b.id)
        if (url) batchResult[b.id] = url
        onProgress(++loaded, total)
      }),
    )
    if (Object.keys(batchResult).length > 0) onBatch(batchResult)
  }

  _done = true
  try { localStorage.setItem(PRELOAD_DONE_KEY, '1') } catch { /* quota exceeded — ignore */ }
}
