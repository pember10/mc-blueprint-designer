import { useEffect } from 'react'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import type { ToolMode } from '@/lib/blueprint/types'

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

interface ToolDef {
  id: ToolMode
  label: string
  mono: string
  desc: string
}

const MODE_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select',  mono: 'SL', desc: 'Click a block to highlight it and inspect its properties.' },
  { id: 'place',  label: 'Place',   mono: 'PL', desc: 'Click to place the active block at the cursor position.' },
  { id: 'erase',  label: 'Erase',   mono: 'ER', desc: 'Click to remove a block, replacing it with air.' },
  { id: 'paint',  label: 'Paint',   mono: 'PT', desc: 'Hold and drag to continuously paint blocks across a stroke.' },
  { id: 'pick',   label: 'Pick',    mono: 'PK', desc: 'Click any block to copy its type to the active slot (eyedropper).' },
  { id: 'tag',    label: 'Tag',     mono: 'TG', desc: 'Click a block to assign MineColonies function tags to it.' },
  { id: 'wand',   label: 'Wand',    mono: 'WD', desc: 'Click two corners to define a cuboid selection region.' },
]

interface ActionDef {
  id: string
  label: string
  mono: string
  desc: string
  group: 'region' | 'clipboard'
}

const ACTION_TOOLS: ActionDef[] = [
  { id: 'fill',    label: 'Fill',    mono: 'FL', desc: 'Flood the entire selected region with the active block.', group: 'region' },
  { id: 'replace', label: 'Replace', mono: 'RP', desc: 'Swap all occurrences of one block type for another within the selection.', group: 'region' },
  { id: 'hollow',  label: 'Hollow',  mono: 'HL', desc: 'Remove all interior blocks from a solid region, keeping only the shell.', group: 'region' },
  { id: 'walls',   label: 'Walls',   mono: 'WL', desc: 'Fill only the four vertical faces of the selection (no floor or ceiling).', group: 'region' },
  { id: 'line',    label: 'Line',    mono: 'LN', desc: 'Draw a straight line of blocks between two clicked points.', group: 'region' },
  { id: 'copy',    label: 'Copy',    mono: 'CP', desc: 'Copy the selected region to the clipboard.', group: 'clipboard' },
  { id: 'paste',   label: 'Paste',   mono: 'PS', desc: 'Place the clipboard contents at the current cursor position.', group: 'clipboard' },
  { id: 'rotate',  label: 'Rotate',  mono: 'RT', desc: 'Rotate the clipboard 90° clockwise around the Y axis.', group: 'clipboard' },
  { id: 'flip',    label: 'Flip',    mono: 'FP', desc: 'Mirror the clipboard across the X axis.', group: 'clipboard' },
  { id: 'stack',   label: 'Stack',   mono: 'ST', desc: 'Repeat the selected region once more in the +X direction.', group: 'clipboard' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSelectionRect(sel: { x1: number; z1: number; x2: number; z2: number } | null) {
  if (!sel) return null
  return {
    x1: Math.min(sel.x1, sel.x2),
    x2: Math.max(sel.x1, sel.x2),
    z1: Math.min(sel.z1, sel.z2),
    z2: Math.max(sel.z1, sel.z2),
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: '#6a6870', padding: '0 2px 2px' }}>
      {children}
    </div>
  )
}

function ToolBtn({
  mono,
  active,
  disabled,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  mono: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  const bg = active ? '#8a6fd6' : disabled ? '#1a1a1d' : '#1f1f23'
  const fg = active ? '#fff' : disabled ? '#3a3a40' : '#c8c6cf'
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      style={{
        aspectRatio: '1',
        border: 'none',
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {mono}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LeftPanel() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const symmetryX = useEditorStore((s) => s.symmetryX)
  const symmetryZ = useEditorStore((s) => s.symmetryZ)
  const toggleSymmetryX = useEditorStore((s) => s.toggleSymmetryX)
  const toggleSymmetryZ = useEditorStore((s) => s.toggleSymmetryZ)
  const showGhost = useEditorStore((s) => s.showGhost)
  const setShowGhost = useEditorStore((s) => s.setShowGhost)
  const selection = useEditorStore((s) => s.selection)
  const setSelection = useEditorStore((s) => s.setSelection)
  const clipboard = useEditorStore((s) => s.clipboard)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const hoveredTool = useEditorStore((s) => s.hoveredTool)
  const setHoveredTool = useEditorStore((s) => s.setHoveredTool)
  const showToast = useEditorStore((s) => s.showToast)
  const activeLayer = useEditorStore((s) => s.activeLayer)

  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setGhost = useBlueprintStore((s) => s.setGhost)
  const ghostLevel = useBlueprintStore((s) => s.ghostLevel)
  const savedLevels = useEditorStore((s) => s.savedLevels)
  const currentLevel = useEditorStore((s) => s.currentLevel)

  // When the active level changes, auto-select the previous level as ghost
  useEffect(() => {
    if (currentLevel <= 1) return
    const prevLevel = currentLevel - 1
    setGhost(useEditorStore.getState().savedLevels[prevLevel] ?? null, prevLevel)
  }, [currentLevel, setGhost])

  const effectiveGhostLevel = ghostLevel ?? Math.max(1, currentLevel - 1)
  const setBlocks = useBlueprintStore((s) => s.setBlocks)
  const ensurePaletteEntry = useBlueprintStore((s) => s.ensurePaletteEntry)
  const selectedBlockName = useEditorStore((s) => s.selectedBlockName)

  const hasSelection = !!selection
  const hasClipboard = !!clipboard
  const rect = getSelectionRect(selection)

  const selectionSizeLabel = rect
    ? `${rect.x2 - rect.x1 + 1} × ${rect.z2 - rect.z1 + 1}`
    : ''

  // Tooltip info
  const allTools = [...MODE_TOOLS, ...ACTION_TOOLS]
  const tooltipTool = allTools.find((t) => t.id === hoveredTool)

  // ── Region operations ────────────────────────────────────────────────────

  const doFill = () => {
    if (!rect || !blueprint) { showToast('Make a selection with Wand first'); return }
    const idx = ensurePaletteEntry(selectedBlockName)
    const entries: { x: number; y: number; z: number; paletteIndex: number }[] = []
    for (let x = rect.x1; x <= rect.x2; x++)
      for (let z = rect.z1; z <= rect.z2; z++)
        entries.push({ x, y: activeLayer, z, paletteIndex: idx })
    setBlocks(entries)
    showToast('Filled selection')
  }

  const doReplace = () => {
    if (!rect || !blueprint) { showToast('Make a selection with Wand first'); return }
    const fromIdx = blueprint.structure[activeLayer]?.[rect.z1]?.[rect.x1] ?? 0
    if (fromIdx === 0) { showToast('Selection corner is air — pick a filled corner'); return }
    const toIdx = ensurePaletteEntry(selectedBlockName)
    const entries: { x: number; y: number; z: number; paletteIndex: number }[] = []
    for (let x = rect.x1; x <= rect.x2; x++)
      for (let z = rect.z1; z <= rect.z2; z++)
        if ((blueprint.structure[activeLayer]?.[z]?.[x] ?? 0) === fromIdx)
          entries.push({ x, y: activeLayer, z, paletteIndex: toIdx })
    setBlocks(entries)
    showToast(`Replaced ${entries.length} block(s)`)
  }

  const doHollow = () => {
    if (!rect || !blueprint) { showToast('Make a selection with Wand first'); return }
    const entries: { x: number; y: number; z: number; paletteIndex: number }[] = []
    for (let x = rect.x1 + 1; x < rect.x2; x++)
      for (let z = rect.z1 + 1; z < rect.z2; z++)
        entries.push({ x, y: activeLayer, z, paletteIndex: 0 })
    setBlocks(entries)
    showToast('Hollowed selection')
  }

  const doWalls = () => {
    if (!rect || !blueprint) { showToast('Make a selection with Wand first'); return }
    const idx = ensurePaletteEntry(selectedBlockName)
    const entries: { x: number; y: number; z: number; paletteIndex: number }[] = []
    for (let x = rect.x1; x <= rect.x2; x++) {
      entries.push({ x, y: activeLayer, z: rect.z1, paletteIndex: idx })
      entries.push({ x, y: activeLayer, z: rect.z2, paletteIndex: idx })
    }
    for (let z = rect.z1 + 1; z < rect.z2; z++) {
      entries.push({ x: rect.x1, y: activeLayer, z, paletteIndex: idx })
      entries.push({ x: rect.x2, y: activeLayer, z, paletteIndex: idx })
    }
    setBlocks(entries)
    showToast('Walls filled')
  }

  const doLine = () => {
    if (!rect || !blueprint) { showToast('Make a selection with Wand first'); return }
    const idx = ensurePaletteEntry(selectedBlockName)
    const dx = rect.x2 - rect.x1, dz = rect.z2 - rect.z1
    const steps = Math.max(Math.abs(dx), Math.abs(dz))
    const entries: { x: number; y: number; z: number; paletteIndex: number }[] = []
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(rect.x1 + (dx * i) / steps)
      const z = Math.round(rect.z1 + (dz * i) / steps)
      entries.push({ x, y: activeLayer, z, paletteIndex: idx })
    }
    setBlocks(entries)
    showToast('Line drawn')
  }

  // ── Clipboard operations ─────────────────────────────────────────────────

  const doCopy = () => {
    if (!rect || !blueprint) { showToast('Make a selection with Wand first'); return }
    const sX = rect.x2 - rect.x1 + 1, sZ = rect.z2 - rect.z1 + 1
    const structure = Array.from({ length: 1 }, () =>
      Array.from({ length: sZ }, (_, dz) =>
        Array.from({ length: sX }, (_, dx) =>
          blueprint.structure[activeLayer]?.[rect.z1 + dz]?.[rect.x1 + dx] ?? 0,
        ),
      ),
    )
    setClipboard({ structure, sizeX: sX, sizeY: 1, sizeZ: sZ })
    showToast(`Copied ${sX}×${sZ}`)
  }

  const doPaste = () => {
    if (!clipboard || !blueprint) { showToast('Nothing in clipboard'); return }
    const entries: { x: number; y: number; z: number; paletteIndex: number }[] = []
    for (let dz = 0; dz < clipboard.sizeZ; dz++)
      for (let dx = 0; dx < clipboard.sizeX; dx++) {
        const paletteIndex = clipboard.structure[0]?.[dz]?.[dx] ?? 0
        entries.push({ x: dx, y: activeLayer, z: dz, paletteIndex })
      }
    setBlocks(entries)
    showToast('Pasted')
  }

  const doRotateClipboard = () => {
    if (!clipboard) { showToast('Nothing in clipboard'); return }
    const { sizeX, sizeZ, structure } = clipboard
    const rotated = Array.from({ length: 1 }, () =>
      Array.from({ length: sizeX }, (_, newZ) =>
        Array.from({ length: sizeZ }, (_, newX) =>
          structure[0]?.[sizeZ - 1 - newX]?.[newZ] ?? 0,
        ),
      ),
    )
    setClipboard({ structure: rotated, sizeX: sizeZ, sizeY: 1, sizeZ: sizeX })
    showToast('Clipboard rotated 90°')
  }

  const doFlipClipboard = () => {
    if (!clipboard) { showToast('Nothing in clipboard'); return }
    const { sizeX, sizeZ, structure } = clipboard
    const flipped = Array.from({ length: 1 }, () =>
      Array.from({ length: sizeZ }, (_, z) =>
        Array.from({ length: sizeX }, (_, x) =>
          structure[0]?.[z]?.[sizeX - 1 - x] ?? 0,
        ),
      ),
    )
    setClipboard({ structure: flipped, sizeX, sizeY: 1, sizeZ })
    showToast('Clipboard flipped')
  }

  const doStack = () => {
    if (!rect || !clipboard || !blueprint) { showToast('Nothing to stack'); return }
    const { sizeX, sizeZ, structure } = clipboard
    const entries: { x: number; y: number; z: number; paletteIndex: number }[] = []
    for (let dz = 0; dz < sizeZ; dz++)
      for (let dx = 0; dx < sizeX; dx++) {
        const paletteIndex = structure[0]?.[dz]?.[dx] ?? 0
        entries.push({ x: sizeX + dx, y: activeLayer, z: dz, paletteIndex })
      }
    setBlocks(entries)
    showToast('Stacked +X')
  }

  const actionHandlers: Record<string, (() => void) | undefined> = {
    fill: doFill,
    replace: doReplace,
    hollow: doHollow,
    walls: doWalls,
    line: doLine,
    copy: doCopy,
    paste: doPaste,
    rotate: doRotateClipboard,
    flip: doFlipClipboard,
    stack: doStack,
  }

  const isActionDisabled = (id: string) => {
    if (['copy', 'fill', 'replace', 'hollow', 'walls', 'line'].includes(id)) return !hasSelection
    if (['paste', 'rotate', 'flip'].includes(id)) return !hasClipboard
    if (id === 'stack') return !hasClipboard
    return false
  }

  const regionActions = ACTION_TOOLS.filter((a) => a.group === 'region')
  const clipboardActions = ACTION_TOOLS.filter((a) => a.group === 'clipboard')

  return (
    <div
      style={{
        width: 224,
        flexShrink: 0,
        background: '#19191c',
        borderRight: '1px solid #2c2c30',
        padding: '18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Tooltip card */}
      <SectionLabel>TOOLS</SectionLabel>
      <div
        style={{
          minHeight: 58,
          background: '#1f1f23',
          border: '1px solid #2c2c30',
          borderRadius: 8,
          padding: '9px 10px',
        }}
      >
        {tooltipTool ? (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#e8e6e3', marginBottom: 3 }}>
              {tooltipTool.label}
            </div>
            <div style={{ fontSize: 11, color: '#8a8892', lineHeight: 1.4 }}>
              {tooltipTool.desc}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: '#5a5860' }}>Hover a tool for details.</div>
        )}
      </div>

      {/* Mode tools (4-column grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {MODE_TOOLS.map((t) => (
          <ToolBtn
            key={t.id}
            mono={t.mono}
            active={tool === t.id}
            onClick={() => setTool(t.id)}
            onMouseEnter={() => setHoveredTool(t.id)}
            onMouseLeave={() => setHoveredTool(null)}
          />
        ))}
      </div>

      {/* Region */}
      <SectionLabel>REGION</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {regionActions.map((a) => (
          <ToolBtn
            key={a.id}
            mono={a.mono}
            disabled={isActionDisabled(a.id)}
            onClick={() => actionHandlers[a.id]?.()}
            onMouseEnter={() => setHoveredTool(a.id)}
            onMouseLeave={() => setHoveredTool(null)}
          />
        ))}
      </div>

      {/* Clipboard */}
      <SectionLabel>CLIPBOARD</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {clipboardActions.map((a) => (
          <ToolBtn
            key={a.id}
            mono={a.mono}
            disabled={isActionDisabled(a.id)}
            onClick={() => actionHandlers[a.id]?.()}
            onMouseEnter={() => setHoveredTool(a.id)}
            onMouseLeave={() => setHoveredTool(null)}
          />
        ))}
      </div>

      {/* Deselect */}
      {hasSelection && (
        <button
          onClick={() => setSelection(null)}
          style={{
            border: '1px solid #33333a',
            borderRadius: 7,
            padding: '9px 0',
            fontSize: 11.5,
            cursor: 'pointer',
            background: 'transparent',
            color: '#8a8892',
          }}
        >
          Deselect ({selectionSizeLabel})
        </button>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: '#2c2c30', margin: '8px 0' }} />

      {/* Symmetry */}
      <SectionLabel>SYMMETRY</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={toggleSymmetryX}
          style={{
            flex: 1, border: 'none', borderRadius: 7, padding: '10px 0',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            background: symmetryX ? '#8a6fd6' : '#2c2c30', color: '#fff',
          }}
        >
          Mirror X
        </button>
        <button
          onClick={toggleSymmetryZ}
          style={{
            flex: 1, border: 'none', borderRadius: 7, padding: '10px 0',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            background: symmetryZ ? '#8a6fd6' : '#2c2c30', color: '#fff',
          }}
        >
          Mirror Z
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#2c2c30', margin: '8px 0' }} />

      {/* Ghost overlay */}
      <SectionLabel>GHOST OVERLAY</SectionLabel>
      <button
        onClick={() => setShowGhost(!showGhost)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: '1px solid #33333a', borderRadius: 7, padding: '9px 12px',
          fontSize: 12.5, cursor: 'pointer', background: '#232326', color: '#c8c6cf',
        }}
      >
        <span>Show previous level</span>
        <span
          style={{
            width: 34, height: 18, borderRadius: 9, position: 'relative',
            background: showGhost ? '#8a6fd6' : '#33333a',
          }}
        />
      </button>
      {showGhost && (
        currentLevel === 1 ? (
          <div style={{ fontSize: 11, color: '#6a6870', padding: '2px 2px 0' }}>
            L1 has no prior level to ghost.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
            <span style={{ fontSize: 12.5, color: '#8a8892', flex: 1 }}>Ghost from</span>
            <select
              value={effectiveGhostLevel}
              onChange={(e) => {
                const lvl = Number(e.target.value)
                setGhost(savedLevels[lvl] ?? null, lvl)
              }}
              style={{
                background: '#1a1a1e', color: '#c8c6cf', border: '1px solid #33333a',
                borderRadius: 6, padding: '5px 8px', fontSize: 12.5, cursor: 'pointer',
              }}
            >
              {[1, 2, 3, 4, 5].filter((lvl) => lvl < currentLevel).map((lvl) => (
                <option key={lvl} value={lvl}>Level {lvl}</option>
              ))}
            </select>
          </div>
        )
      )}
    </div>
  )
}
