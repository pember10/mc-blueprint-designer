/**
 * Local file I/O — upload from / download to the browser filesystem.
 */

import { parseBlueprint } from '@/lib/nbt/parser'
import { serializeBlueprint } from '@/lib/nbt/serializer'
import type { Blueprint } from '@/lib/blueprint/types'

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/** Open a file picker and parse the selected .blueprint file */
export function openBlueprintFile(): Promise<Blueprint> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.blueprint'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { reject(new Error('No file selected')); return }
      try {
        const buffer = await file.arrayBuffer()
        const bp = await parseBlueprint(buffer)
        bp.meta.fileName = file.name.replace(/\.blueprint$/, '')
        resolve(bp)
      } catch (err) {
        reject(err)
      }
    }
    input.click()
  })
}

/** Parse a blueprint from a dropped File object */
export async function parseBlueprintFile(file: File): Promise<Blueprint> {
  const buffer = await file.arrayBuffer()
  const bp = await parseBlueprint(buffer)
  bp.meta.fileName = file.name.replace(/\.blueprint$/, '')
  return bp
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/** Serialize and trigger a browser download of the .blueprint file */
export function downloadBlueprint(bp: Blueprint): void {
  const bytes = serializeBlueprint(bp)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (bp.meta.fileName || bp.meta.name || 'blueprint') + '.blueprint'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
