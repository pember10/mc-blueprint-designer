import { create } from 'zustand'
import type { ToolMode } from '@/lib/blueprint/types'

// ---------------------------------------------------------------------------
// Editor UI store — transient state that does NOT participate in undo/redo
// ---------------------------------------------------------------------------

interface DragState {
  blockName: string
  /** Palette index in the current blueprint, or -1 if not yet resolved */
  paletteIndex: number
  /** Data URL of the block's texture thumbnail for the drag cursor overlay */
  textureDataUrl: string
}

interface EditorStore {
  // Tool
  tool: ToolMode
  setTool: (t: ToolMode) => void

  // Active block for Place / Paint / Erase
  selectedBlockName: string
  setSelectedBlock: (name: string) => void

  // Y-layer slice
  activeLayer: number
  setActiveLayer: (y: number) => void

  // Symmetry
  symmetryX: boolean
  symmetryZ: boolean
  toggleSymmetryX: () => void
  toggleSymmetryZ: () => void

  // Ghost overlay
  showGhost: boolean
  ghostOpacity: number
  setShowGhost: (v: boolean) => void
  setGhostOpacity: (v: number) => void

  // Drag-from-palette state
  dragging: DragState | null
  setDragging: (d: DragState | null) => void

  // Hover position in 3-D (snapped to grid)
  hoverPos: { x: number; y: number; z: number } | null
  setHoverPos: (p: { x: number; y: number; z: number } | null) => void

  // Block selected via gizmo (Select mode)
  selectedPos: { x: number; y: number; z: number } | null
  setSelectedPos: (p: { x: number; y: number; z: number } | null) => void

  // Tag panel target
  tagTargetPos: { x: number; y: number; z: number } | null
  setTagTargetPos: (p: { x: number; y: number; z: number } | null) => void
}

export const useEditorStore = create<EditorStore>()((set) => ({
  tool: 'place',
  setTool: (t) => set({ tool: t }),

  selectedBlockName: 'minecraft:stone',
  setSelectedBlock: (name) => set({ selectedBlockName: name }),

  activeLayer: 0,
  setActiveLayer: (y) => set({ activeLayer: y }),

  symmetryX: false,
  symmetryZ: false,
  toggleSymmetryX: () => set((s) => ({ symmetryX: !s.symmetryX })),
  toggleSymmetryZ: () => set((s) => ({ symmetryZ: !s.symmetryZ })),

  showGhost: true,
  ghostOpacity: 0.25,
  setShowGhost: (v) => set({ showGhost: v }),
  setGhostOpacity: (v) => set({ ghostOpacity: v }),

  dragging: null,
  setDragging: (d) => set({ dragging: d }),

  hoverPos: null,
  setHoverPos: (p) => set({ hoverPos: p }),

  selectedPos: null,
  setSelectedPos: (p) => set({ selectedPos: p }),

  tagTargetPos: null,
  setTagTargetPos: (p) => set({ tagTargetPos: p }),
}))
