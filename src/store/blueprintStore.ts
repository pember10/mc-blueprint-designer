import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Blueprint } from '@/lib/blueprint/types'

// ---------------------------------------------------------------------------
// Blueprint store — holds the active blueprint data + undo/redo via zundo
// ---------------------------------------------------------------------------

/** Snapshot of blueprint state that participates in undo/redo */
interface BlueprintSnapshot {
  blueprint: Blueprint | null
  ghostBlueprint: Blueprint | null
  ghostLevel: number | null
}

interface BlueprintStore extends BlueprintSnapshot {
  setBlueprint: (bp: Blueprint) => void
  setGhost: (bp: Blueprint | null, level: number | null) => void

  /** Replace a single block in structure[y][z][x]; grows palette if needed */
  setBlock: (x: number, y: number, z: number, paletteIndex: number) => void

  /** Batch-replace multiple blocks as one undoable action */
  setBlocks: (entries: Array<{ x: number; y: number; z: number; paletteIndex: number }>) => void

  /**
   * Ensure a BlockState is in the palette, returning its index.
   * Index 0 is always air.
   */
  ensurePaletteEntry: (name: string, properties?: Record<string, string>) => number
}

function makeBlueprint(): Blueprint {
  return {
    palette: [{ name: 'minecraft:air' }],
    structure: [[[0]]],
    sizeX: 1,
    sizeY: 1,
    sizeZ: 1,
    tileEntities: [],
    entities: [],
    requiredMods: [],
    mcVersion: 4325, // Minecraft 1.21
    meta: {
      name: '',
      fileName: '',
      packName: '',
      primaryOffset: { x: 0, y: 0, z: 0 },
      architects: [],
    },
  }
}

function emptyStructure(sX: number, sY: number, sZ: number): number[][][] {
  return Array.from({ length: sY }, () =>
    Array.from({ length: sZ }, () => new Array(sX).fill(0)),
  )
}

export const useBlueprintStore = create<BlueprintStore>()(
  temporal(
    (set, get) => ({
      blueprint: null,
      ghostBlueprint: null,
      ghostLevel: null,

      setBlueprint: (bp) => set({ blueprint: bp }),

      setGhost: (bp, level) => set({ ghostBlueprint: bp, ghostLevel: level }),

      setBlock: (x, y, z, paletteIndex) =>
        set((state) => {
          if (!state.blueprint) return state
          const bp = structuredClone(state.blueprint)
          bp.structure[y][z][x] = paletteIndex
          return { blueprint: bp }
        }),

      setBlocks: (entries) =>
        set((state) => {
          if (!state.blueprint) return state
          const bp = structuredClone(state.blueprint)
          for (const { x, y, z, paletteIndex } of entries) {
            bp.structure[y][z][x] = paletteIndex
          }
          return { blueprint: bp }
        }),

      ensurePaletteEntry: (name, properties) => {
        const bp = get().blueprint
        if (!bp) return 0
        const idx = bp.palette.findIndex(
          (s) =>
            s.name === name &&
            JSON.stringify(s.properties ?? {}) === JSON.stringify(properties ?? {}),
        )
        if (idx !== -1) return idx
        // Add to palette (mutate via set so it's captured by temporal)
        const newIdx = bp.palette.length
        set((state) => {
          if (!state.blueprint) return state
          const next = structuredClone(state.blueprint)
          next.palette.push({ name, properties })
          return { blueprint: next }
        })
        return newIdx
      },
    }),
    {
      // Only track the blueprint snapshot in undo history
      partialize: (state) => ({
        blueprint: state.blueprint,
        ghostBlueprint: state.ghostBlueprint,
        ghostLevel: state.ghostLevel,
      }),
    },
  ),
)

// Re-export temporal controls for undo/redo
export { makeBlueprint, emptyStructure }
