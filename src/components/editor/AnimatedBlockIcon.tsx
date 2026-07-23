/**
 * Canvas-based block icon that correctly animates Minecraft sprite sheets.
 *
 * - Detects sprite sheets (h > w && h % w === 0) from the data URL.
 * - Registers in a module-level registry ticked by a single shared setInterval(100ms).
 * - When `texId` is provided, fetches the .mcmeta frame sequence so ping-pong
 *   animations (lava, water, etc.) play correctly instead of linearly.
 * - Accepts an optional `style` prop for absolute positioning in LayerGrid cells.
 * - Canvas pixel size is always `size`; the parent can override CSS display size
 *   via `style` (e.g. `{ width: cellSize, height: cellSize }`) without causing
 *   a re-render of the canvas content on zoom.
 */

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { fetchTextureMcmeta } from '@/lib/blocks/textures'

// ---------------------------------------------------------------------------
// Module-level animation registry
// ---------------------------------------------------------------------------

interface AnimEntry {
  canvas: HTMLCanvasElement
  img: HTMLImageElement
  frameCount: number   // total rows in the sprite sheet
  frames: number[]     // playback sequence (from mcmeta or [0..N-1])
  seqIdx: number       // current position within frames[]
  frameSize: number    // img.naturalWidth — native pixel size per frame
  color: string        // background fill color (shows through transparent pixels)
}

const animRegistry: AnimEntry[] = []
let animInterval: ReturnType<typeof setInterval> | null = null

/** Fill or clear the canvas background depending on color. */
function drawBg(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
  if (!color || color === 'transparent') {
    ctx.clearRect(0, 0, w, h)
  } else {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
  }
}

function ensureInterval() {
  if (animInterval !== null) return
  animInterval = setInterval(() => {
    for (const entry of animRegistry) {
      entry.seqIdx = (entry.seqIdx + 1) % entry.frames.length
      const frame = entry.frames[entry.seqIdx]
      const ctx = entry.canvas.getContext('2d')
      if (!ctx) continue
      const ds = entry.canvas.width   // display-pixel size of the canvas buffer
      const fs = entry.frameSize      // native sprite-sheet frame size
      drawBg(ctx, entry.color, ds, ds)
      ctx.drawImage(entry.img, 0, frame * fs, fs, fs, 0, 0, ds, ds)
    }
  }, 100)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  /** Full sprite-sheet data URL (or single-frame texture). Undefined = plain color. */
  src?: string
  /** Canvas pixel buffer size (also CSS size unless overridden by `style`). */
  size: number
  /** Fallback fill color when `src` is absent. */
  color: string
  /**
   * Texture ID used to fetch .mcmeta animation metadata.
   * E.g. "block/lava_still" or "minecraft:block/water_still".
   * When omitted the animation plays frames linearly 0 → N-1 → 0.
   */
  texId?: string
  /** Extra CSS applied to the <canvas> element. */
  style?: CSSProperties
}

export function AnimatedBlockIcon({ src, size, color, texId, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (!src) {
      // No texture — draw registry colour
      const ctx = canvas.getContext('2d')
      if (ctx) { drawBg(ctx, color, size, size) }
      return
    }

    const img = new Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      const isAnimated = h > w && h % w === 0
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false

      if (!isAnimated) {
        drawBg(ctx, color, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        return
      }

      // ── Animated sprite sheet ──────────────────────────────────────────
      const frameCount = h / w
      const defaultFrames = Array.from({ length: frameCount }, (_, i) => i)

      // Draw frame 0 immediately so the icon isn't blank during mcmeta fetch
      drawBg(ctx, color, size, size)
      ctx.drawImage(img, 0, 0, w, w, 0, 0, size, size)

      const entry: AnimEntry = {
        canvas, img,
        frameCount,
        frames: defaultFrames,
        seqIdx: 0,
        frameSize: w,
        color,
      }
      animRegistry.push(entry)
      ensureInterval()

      // Fetch mcmeta to replace the linear default with the real sequence
      if (texId) {
        fetchTextureMcmeta(texId).then((meta) => {
          if (!meta?.frames) return
          entry.frames = meta.frames.map((f) => (typeof f === 'number' ? f : f.index))
          entry.seqIdx = 0
        })
      }

      // Store cleanup on the canvas element so the effect teardown can reach it
      ;(canvas as unknown as Record<string, unknown>)._animCleanup = () => {
        const idx = animRegistry.indexOf(entry)
        if (idx !== -1) animRegistry.splice(idx, 1)
        if (animRegistry.length === 0 && animInterval !== null) {
          clearInterval(animInterval)
          animInterval = null
        }
      }
    }
    img.src = src

    return () => {
      const cleanup = (canvas as unknown as Record<string, unknown>)._animCleanup as (() => void) | undefined
      cleanup?.()
      delete (canvas as unknown as Record<string, unknown>)._animCleanup
    }
  }, [src, size, color, texId])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', width: size, height: size, display: 'block', ...style }}
    />
  )
}
