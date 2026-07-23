import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Blueprint, ToolMode } from '@/lib/blueprint/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Selection {
  x1: number
  z1: number
  x2: number
  z2: number
}

export interface ClipboardData {
  structure: number[][][]
  sizeX: number
  sizeY: number
  sizeZ: number
}

export interface EditorSettings {
  maxY: number    // 1-12, Y layers per level
  gridX: number   // 2-32, blueprint X size
  gridZ: number   // 2-32, blueprint Z size
  showTagMarkers: boolean
  showMirrorPreview: boolean
  reduceMotion: boolean
}

export type RailTab = 'palette' | 'metadata' | 'blockList' | 'packBuildings' | 'validation'

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface EditorStore {
  // Tool
  tool: ToolMode
  setTool: (t: ToolMode) => void

  // Current hut level being edited (1-5)
  currentLevel: number
  setCurrentLevel: (n: number) => void

  // Active block (block ID string)
  selectedBlockName: string
  setSelectedBlock: (name: string) => void

  // Y-layer being edited
  activeLayer: number
  setActiveLayer: (y: number) => void

  // Symmetry
  symmetryX: boolean
  symmetryZ: boolean
  toggleSymmetryX: () => void
  toggleSymmetryZ: () => void

  // Ghost overlay
  showGhost: boolean
  setShowGhost: (v: boolean) => void

  // Wand selection
  selection: Selection | null
  isSelecting: boolean
  setSelection: (s: Selection | null) => void
  setIsSelecting: (v: boolean) => void

  // Hover cell (for highlight/tooltip in 2D grid)
  hoverCell: { x: number; z: number } | null
  setHoverCell: (c: { x: number; z: number } | null) => void

  // Clipboard (copy/paste)
  clipboard: ClipboardData | null
  setClipboard: (c: ClipboardData | null) => void

  // Editor settings (grid size, visual prefs)
  settings: EditorSettings
  updateSettings: (patch: Partial<EditorSettings>) => void

  // Right rail active tab
  railTab: RailTab
  setRailTab: (t: RailTab) => void

  // Inspected cell (select tool)
  inspectedCell: { x: number; y: number; z: number } | null
  setInspectedCell: (c: { x: number; y: number; z: number } | null) => void

  // Tag target cell (tag tool)
  tagTargetCell: { x: number; y: number; z: number } | null
  setTagTargetCell: (c: { x: number; y: number; z: number } | null) => void

  // In-memory tags: key = "x_y_z", value = tag ID
  tags: Record<string, string>
  setTag: (key: string, tagId: string) => void
  clearTag: (key: string) => void
  clearAllTags: () => void

  // Hovered tool ID for tooltip in left panel
  hoveredTool: string | null
  setHoveredTool: (id: string | null) => void

  // Session: building names worked on this session
  sessionBuildings: string[]
  addSessionBuilding: (name: string) => void

  // Jump-to highlight (from block list)
  highlightBlock: string | null
  setHighlightBlock: (id: string | null) => void

  // Texture map loaded from resource pack: blockId → data URL
  textureMap: Record<string, string>
  setTextureMap: (m: Record<string, string>) => void

  // Toast notification
  toast: string | null
  showToast: (msg: string) => void

  // 3D preview rotation index (0-3, multiples of 90 deg)
  previewRotation: number
  setPreviewRotation: (r: number) => void

  // Modal visibility
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  showResourcePack: boolean
  setShowResourcePack: (v: boolean) => void
  show3DModal: boolean
  setShow3DModal: (v: boolean) => void
  /** True after a JAR or resource pack with block models has been imported */
  modelDataLoaded: boolean
  setModelDataLoaded: (v: boolean) => void

  // Per-level blueprint snapshots: key = level number (1-5)
  savedLevels: Record<number, Blueprint>
  saveCurrentLevel: (level: number, bp: Blueprint) => void

  // Which building name is currently being edited
  activeBuildingName: string

  // All buildings' work: building name → level → Blueprint
  buildingSnapshots: Record<string, Record<number, Blueprint>>
  /** Save current savedLevels under old name, load target building’s levels */
  switchToBuilding: (name: string) => void

  // Tracking exports: building name → array of exported level numbers
  exportedBuildings: Record<string, number[]>
  markLevelExported: (buildingName: string, level: number) => void
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

let _toastTimer: ReturnType<typeof setTimeout> | null = null

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
  tool: 'place',
  setTool: (t) => set({ tool: t }),

  currentLevel: 1,
  setCurrentLevel: (n) => set({ currentLevel: n }),

  selectedBlockName: 'minecraft:stone',
  setSelectedBlock: (name) => set({ selectedBlockName: name }),

  activeLayer: 0,
  setActiveLayer: (y) => set({ activeLayer: y }),

  symmetryX: false,
  symmetryZ: false,
  toggleSymmetryX: () => set((s) => ({ symmetryX: !s.symmetryX })),
  toggleSymmetryZ: () => set((s) => ({ symmetryZ: !s.symmetryZ })),

  showGhost: true,
  setShowGhost: (v) => set({ showGhost: v }),

  selection: null,
  isSelecting: false,
  setSelection: (s) => set({ selection: s }),
  setIsSelecting: (v) => set({ isSelecting: v }),

  hoverCell: null,
  setHoverCell: (c) => set({ hoverCell: c }),

  clipboard: null,
  setClipboard: (c) => set({ clipboard: c }),

  settings: {
    maxY: 6,
    gridX: 8,
    gridZ: 8,
    showTagMarkers: true,
    showMirrorPreview: true,
    reduceMotion: false,
  },
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  railTab: 'palette',
  setRailTab: (t) => set({ railTab: t }),

  inspectedCell: null,
  setInspectedCell: (c) => set({ inspectedCell: c }),

  tagTargetCell: null,
  setTagTargetCell: (c) => set({ tagTargetCell: c }),

  tags: {},
  setTag: (key, tagId) => set((s) => ({ tags: { ...s.tags, [key]: tagId } })),
  clearTag: (key) =>
    set((s) => {
      const next = { ...s.tags }
      delete next[key]
      return { tags: next }
    }),
  clearAllTags: () => set({ tags: {} }),

  hoveredTool: null,
  setHoveredTool: (id) => set({ hoveredTool: id }),

  sessionBuildings: [],
  addSessionBuilding: (name) =>
    set((s) =>
      s.sessionBuildings.includes(name)
        ? s
        : { sessionBuildings: [...s.sessionBuildings, name] },
    ),

  highlightBlock: null,
  setHighlightBlock: (id) => set({ highlightBlock: id }),

  textureMap: {},
  setTextureMap: (m) => set({ textureMap: m }),

  toast: null,
  showToast: (msg) => {
    set({ toast: msg })
    if (_toastTimer) clearTimeout(_toastTimer)
    _toastTimer = setTimeout(() => set({ toast: null }), 2600)
  },

  previewRotation: 0,
  setPreviewRotation: (r) => set({ previewRotation: r }),

  showSettings: false,
  setShowSettings: (v) => set({ showSettings: v }),
  showResourcePack: false,
  setShowResourcePack: (v) => set({ showResourcePack: v }),
  show3DModal: false,
  setShow3DModal: (v) => set({ show3DModal: v }),
  modelDataLoaded: false,
  setModelDataLoaded: (v) => set({ modelDataLoaded: v }),

  savedLevels: {},
  saveCurrentLevel: (level, bp) =>
    set((s) => {
      const newSaved = { ...s.savedLevels, [level]: bp }
      const newSnapshots = s.activeBuildingName
        ? { ...s.buildingSnapshots, [s.activeBuildingName]: { ...(s.buildingSnapshots[s.activeBuildingName] ?? {}), [level]: bp } }
        : s.buildingSnapshots
      return { savedLevels: newSaved, buildingSnapshots: newSnapshots }
    }),

  activeBuildingName: '',

  buildingSnapshots: {},
  switchToBuilding: (newName) =>
    set((s) => {
      // Flush current work to the old building’s snapshot
      const updatedSnapshots = { ...s.buildingSnapshots }
      if (s.activeBuildingName) {
        updatedSnapshots[s.activeBuildingName] = { ...s.savedLevels }
      }
      // Load target building’s levels (or empty)
      const newLevels = (updatedSnapshots[newName] ?? {}) as Record<number, Blueprint>
      return { buildingSnapshots: updatedSnapshots, activeBuildingName: newName, savedLevels: newLevels }
    }),

  exportedBuildings: {},
  markLevelExported: (buildingName, level) =>
    set((s) => {
      const current = s.exportedBuildings[buildingName] ?? []
      if (current.includes(level)) return s
      return { exportedBuildings: { ...s.exportedBuildings, [buildingName]: [...current, level].sort((a, b) => a - b) } }
    }),
  }),
  {
    name: 'mc-blueprint-editor',
    partialize: (s) => ({
      currentLevel: s.currentLevel,
      selectedBlockName: s.selectedBlockName,
      settings: s.settings,
      sessionBuildings: s.sessionBuildings,
      activeBuildingName: s.activeBuildingName,
      buildingSnapshots: s.buildingSnapshots,
      exportedBuildings: s.exportedBuildings,
    }),
  }
  )
)
