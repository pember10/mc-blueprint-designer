import { useStore } from 'zustand'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import type { ToolMode } from '@/lib/blueprint/types'
import { openBlueprintFile, downloadBlueprint } from '@/lib/io/localIO'
import { makeBlueprint } from '@/store/blueprintStore'

const TOOLS: { mode: ToolMode; label: string; shortcut: string }[] = [
  { mode: 'select', label: 'Select', shortcut: 'S' },
  { mode: 'place', label: 'Place', shortcut: 'P' },
  { mode: 'erase', label: 'Erase', shortcut: 'E' },
  { mode: 'paint', label: 'Paint', shortcut: 'B' },
  { mode: 'pick', label: 'Pick', shortcut: 'I' },
  { mode: 'tag', label: 'Tag', shortcut: 'T' },
]

export default function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const symmetryX = useEditorStore((s) => s.symmetryX)
  const symmetryZ = useEditorStore((s) => s.symmetryZ)
  const toggleSymmetryX = useEditorStore((s) => s.toggleSymmetryX)
  const toggleSymmetryZ = useEditorStore((s) => s.toggleSymmetryZ)
  const showGhost = useEditorStore((s) => s.showGhost)
  const ghostOpacity = useEditorStore((s) => s.ghostOpacity)
  const setShowGhost = useEditorStore((s) => s.setShowGhost)
  const setGhostOpacity = useEditorStore((s) => s.setGhostOpacity)
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)

  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const ghostLevel = useBlueprintStore((s) => s.ghostLevel)

  // Undo / redo from zundo temporal store
  const undo = () => useBlueprintStore.temporal.getState().undo()
  const redo = () => useBlueprintStore.temporal.getState().redo()
  const canUndo = useStore(useBlueprintStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useBlueprintStore.temporal, (s) => s.futureStates.length > 0)

  const handleNew = () => {
    const bp = makeBlueprint()
    bp.sizeX = 16
    bp.sizeY = 10
    bp.sizeZ = 16
    bp.structure = Array.from({ length: 10 }, () =>
      Array.from({ length: 16 }, () => new Array(16).fill(0)),
    )
    setBlueprint(bp)
  }

  const handleOpen = async () => {
    try {
      const bp = await openBlueprintFile()
      setBlueprint(bp)
      setActiveLayer(bp.sizeY - 1)
    } catch (e) {
      console.error('Failed to open blueprint:', e)
    }
  }

  const handleDownload = () => {
    if (!blueprint) return
    downloadBlueprint(blueprint)
  }

  const maxLayer = blueprint ? blueprint.sizeY - 1 : 0

  return (
    <div className="flex items-center gap-3 px-3 h-12 bg-zinc-900 border-b border-zinc-700 shrink-0 overflow-x-auto">
      {/* File actions */}
      <div className="flex gap-1">
        <ToolbarBtn onClick={handleNew}>New</ToolbarBtn>
        <ToolbarBtn onClick={handleOpen}>Open</ToolbarBtn>
        <ToolbarBtn onClick={handleDownload} disabled={!blueprint}>Export</ToolbarBtn>
      </div>

      <Divider />

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <ToolbarBtn onClick={undo} disabled={!canUndo} title="Ctrl+Z">
          ↩ Undo
        </ToolbarBtn>
        <ToolbarBtn onClick={redo} disabled={!canRedo} title="Ctrl+Y">
          ↪ Redo
        </ToolbarBtn>
      </div>

      <Divider />

      {/* Tool modes */}
      <div className="flex gap-1">
        {TOOLS.map(({ mode, label, shortcut }) => (
          <ToolbarBtn
            key={mode}
            active={tool === mode}
            onClick={() => setTool(mode)}
            title={`${label} (${shortcut})`}
          >
            {label}
          </ToolbarBtn>
        ))}
      </div>

      <Divider />

      {/* Symmetry */}
      <div className="flex gap-1 items-center">
        <span className="text-zinc-400 text-xs">Sym:</span>
        <ToolbarBtn active={symmetryX} onClick={toggleSymmetryX} title="Mirror X axis (X)">
          ↔ X
        </ToolbarBtn>
        <ToolbarBtn active={symmetryZ} onClick={toggleSymmetryZ} title="Mirror Z axis (Z)">
          ↕ Z
        </ToolbarBtn>
      </div>

      <Divider />

      {/* Y Layer */}
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400 text-xs">Layer:</span>
        <button
          className="w-5 h-5 rounded bg-zinc-700 text-zinc-200 text-xs hover:bg-zinc-600 disabled:opacity-30"
          onClick={() => setActiveLayer(Math.max(0, activeLayer - 1))}
          disabled={activeLayer <= 0}
        >
          −
        </button>
        <span className="text-zinc-100 text-xs w-6 text-center">{activeLayer}</span>
        <button
          className="w-5 h-5 rounded bg-zinc-700 text-zinc-200 text-xs hover:bg-zinc-600 disabled:opacity-30"
          onClick={() => setActiveLayer(Math.min(maxLayer, activeLayer + 1))}
          disabled={activeLayer >= maxLayer}
        >
          +
        </button>
        <span className="text-zinc-500 text-xs">/ {maxLayer}</span>
      </div>

      <Divider />

      {/* Ghost */}
      <div className="flex items-center gap-1.5">
        <ToolbarBtn active={showGhost} onClick={() => setShowGhost(!showGhost)} title="Toggle ghost (G)">
          👻 Ghost{ghostLevel !== null ? ` (L${ghostLevel})` : ''}
        </ToolbarBtn>
        {showGhost && (
          <input
            type="range"
            min={0}
            max={50}
            value={Math.round(ghostOpacity * 100)}
            onChange={(e) => setGhostOpacity(Number(e.target.value) / 100)}
            className="w-16 accent-indigo-500"
            title="Ghost opacity"
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny sub-components
// ---------------------------------------------------------------------------

interface ToolbarBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

function ToolbarBtn({ active, className = '', children, ...rest }: ToolbarBtnProps) {
  return (
    <button
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
      } disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-6 bg-zinc-700" />
}
