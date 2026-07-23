import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { resolveColorSync } from '@/lib/blocks/textures'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_CELL = 30
const GAP = 2
const PAD = 10

// ---------------------------------------------------------------------------
// Tag helpers
// ---------------------------------------------------------------------------

const TAG_COLORS: Record<string, string> = {
  groundlevel: '#5c9cd9', work: '#d9943f', crafting: '#8f7bd9',
  sleeping: '#5c9cd9', storage: '#a9743a', guard: '#a13d3d', ladder: '#6fae6f',
}

function tagColor(tagId: string) { return TAG_COLORS[tagId] ?? '#888888' }
function tagLetter(tagId: string) { return tagId.charAt(0).toUpperCase() }

// ---------------------------------------------------------------------------
// Mirror helper
// ---------------------------------------------------------------------------

function getMirrorCells(x: number, z: number, symX: boolean, symZ: boolean, gx: number, gz: number) {
  const map = new Map<string, { x: number; z: number }>()
  const mx = gx - 1 - x, mz = gz - 1 - z
  map.set(`${x},${z}`, { x, z })
  if (symX) map.set(`${mx},${z}`, { x: mx, z })
  if (symZ) map.set(`${x},${mz}`, { x, z: mz })
  if (symX && symZ) map.set(`${mx},${mz}`, { x: mx, z: mz })
  return [...map.values()]
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || hex.length < 7) return `rgba(100,100,100,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LayerGrid() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const ghostBlueprint = useBlueprintStore((s) => s.ghostBlueprint)
  const setBlocks = useBlueprintStore((s) => s.setBlocks)
  const ensurePaletteEntry = useBlueprintStore((s) => s.ensurePaletteEntry)

  const tool = useEditorStore((s) => s.tool)
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const selectedBlockName = useEditorStore((s) => s.selectedBlockName)
  const symmetryX = useEditorStore((s) => s.symmetryX)
  const symmetryZ = useEditorStore((s) => s.symmetryZ)
  const showGhost = useEditorStore((s) => s.showGhost)
  const selection = useEditorStore((s) => s.selection)
  const isSelecting = useEditorStore((s) => s.isSelecting)
  const setSelection = useEditorStore((s) => s.setSelection)
  const setIsSelecting = useEditorStore((s) => s.setIsSelecting)
  const hoverCell = useEditorStore((s) => s.hoverCell)
  const setHoverCell = useEditorStore((s) => s.setHoverCell)
  const setTool = useEditorStore((s) => s.setTool)
  const setSelectedBlock = useEditorStore((s) => s.setSelectedBlock)
  const setInspectedCell = useEditorStore((s) => s.setInspectedCell)
  const setTagTargetCell = useEditorStore((s) => s.setTagTargetCell)
  const tags = useEditorStore((s) => s.tags)
  const settings = useEditorStore((s) => s.settings)
  const textureMap = useEditorStore((s) => s.textureMap)
  const highlightBlock = useEditorStore((s) => s.highlightBlock)
  const showToast = useEditorStore((s) => s.showToast)

  const { showTagMarkers } = settings
  const GX = blueprint?.sizeX ?? settings.gridX
  const GZ = blueprint?.sizeZ ?? settings.gridZ
  const painting = useRef(false)
  const wandAnchor = useRef<{ x: number; z: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoFitScale, setAutoFitScale] = useState(1)
  const [userZoom, setUserZoom] = useState(1)
  const cellSize = Math.max(6, Math.round(BASE_CELL * autoFitScale * userZoom))

  // Auto-fit scale: shrink to fit container, never enlarge
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      const gridW = GX * BASE_CELL + (GX - 1) * GAP + PAD * 2
      const gridH = GZ * BASE_CELL + (GZ - 1) * GAP + PAD * 2
      const s = Math.min(width / gridW, height / gridH, 1)
      setAutoFitScale(s > 0 ? s : 1)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [GX, GZ])

  // Ctrl+scroll to zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setUserZoom((prev) => Math.min(Math.max(prev * factor, 0.25), 6))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keep viewport center stable when zoom changes
  const prevUserZoomRef = useRef(1)
  useEffect(() => {
    const el = containerRef.current
    if (!el || userZoom === prevUserZoomRef.current) return
    const factor = userZoom / prevUserZoomRef.current
    const cx = el.scrollLeft + el.clientWidth / 2
    const cy = el.scrollTop + el.clientHeight / 2
    el.scrollLeft = cx * factor - el.clientWidth / 2
    el.scrollTop = cy * factor - el.clientHeight / 2
    prevUserZoomRef.current = userZoom
  }, [userZoom])

  // ── Apply tool ────────────────────────────────────────────────────────────

  const applyAt = useCallback(
    (x: number, z: number) => {
      if (!blueprint) return
      const y = activeLayer

      if (tool === 'place' || tool === 'paint') {
        const pidx = ensurePaletteEntry(selectedBlockName)
        const targets = getMirrorCells(x, z, symmetryX, symmetryZ, GX, GZ)
        setBlocks(targets.map((t) => ({ x: t.x, y, z: t.z, paletteIndex: pidx })))
      } else if (tool === 'erase') {
        const targets = getMirrorCells(x, z, symmetryX, symmetryZ, GX, GZ)
        setBlocks(targets.map((t) => ({ x: t.x, y, z: t.z, paletteIndex: 0 })))
      } else if (tool === 'pick') {
        const pidx = blueprint.structure[y]?.[z]?.[x] ?? 0
        if (pidx !== 0) {
          const name = blueprint.palette[pidx]?.name
          if (name) { setSelectedBlock(name); setTool('place') }
        }
      } else if (tool === 'select') {
        setInspectedCell({ x, y, z })
      } else if (tool === 'tag') {
        const pidx = blueprint.structure[y]?.[z]?.[x] ?? 0
        if (pidx !== 0) setTagTargetCell({ x, y, z })
        else showToast('Click a non-air block to assign a tag')
      }
    },
    [blueprint, activeLayer, tool, selectedBlockName, symmetryX, symmetryZ, GX, GZ,
      ensurePaletteEntry, setBlocks, setSelectedBlock, setTool, setInspectedCell, setTagTargetCell, showToast],
  )

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const onCellDown = useCallback((x: number, z: number) => {
    if (tool === 'wand') {
      wandAnchor.current = { x, z }
      setIsSelecting(true)
      setSelection({ x1: x, z1: z, x2: x, z2: z })
      return
    }
    painting.current = true
    applyAt(x, z)
  }, [tool, applyAt, setIsSelecting, setSelection])

  const onCellEnter = useCallback((x: number, z: number) => {
    setHoverCell({ x, z })
    if (tool === 'paint' && painting.current) applyAt(x, z)
    if (tool === 'wand' && isSelecting && wandAnchor.current) {
      setSelection({ x1: wandAnchor.current.x, z1: wandAnchor.current.z, x2: x, z2: z })
    }
  }, [tool, isSelecting, applyAt, setHoverCell, setSelection])

  const onGridUp = useCallback(() => {
    painting.current = false
    setIsSelecting(false)
  }, [setIsSelecting])

  const onGridLeave = useCallback(() => {
    setHoverCell(null)
    painting.current = false
  }, [setHoverCell])

  // ── Compute cell data ─────────────────────────────────────────────────────

  const cells = useMemo(() => {
    if (!blueprint) return []
    const layer = blueprint.structure[activeLayer]
    const ghostLayer = showGhost ? ghostBlueprint?.structure[activeLayer] : undefined

    const selRect = selection ? {
      x1: Math.min(selection.x1, selection.x2), x2: Math.max(selection.x1, selection.x2),
      z1: Math.min(selection.z1, selection.z2), z2: Math.max(selection.z1, selection.z2),
    } : null

    const mirrorSet = (hoverCell && (symmetryX || symmetryZ))
      ? new Set(getMirrorCells(hoverCell.x, hoverCell.z, symmetryX, symmetryZ, GX, GZ).map((c) => `${c.x},${c.z}`))
      : new Set<string>()

    const out = []
    for (let z = 0; z < GZ; z++) {
      for (let x = 0; x < GX; x++) {
        const pidx = layer?.[z]?.[x] ?? 0
        const bname = blueprint.palette[pidx]?.name ?? 'minecraft:air'
        const isAir = pidx === 0

        const gidx = ghostLayer?.[z]?.[x] ?? 0
        const gname = ghostBlueprint?.palette[gidx]?.name ?? 'minecraft:air'
        const hasGhost = showGhost && gidx !== 0 && gname !== 'minecraft:air'

        const color = isAir ? null : resolveColorSync(bname)
        // Texture keys in the map are always property-stripped (from resource pack paths)
        const texKey = bname.includes('[') ? bname.slice(0, bname.indexOf('[')) : bname
        const tex = !isAir ? textureMap[texKey] ?? null : null
        const ghostCol = hasGhost ? resolveColorSync(gname) : null

        const key = `${x},${z}`
        const isHover = hoverCell?.x === x && hoverCell?.z === z
        const isMirror = mirrorSet.has(key) && !isHover
        const inSel = selRect
          ? x >= selRect.x1 && x <= selRect.x2 && z >= selRect.z1 && z <= selRect.z2
          : false
        const isHL = !!highlightBlock && bname === highlightBlock
        const tagId = showTagMarkers ? (tags[`${x}_${activeLayer}_${z}`] ?? null) : null

        let bgColor = '#131315'
        if (!isAir) bgColor = color!
        else if (hasGhost && ghostCol) bgColor = hexToRgba(ghostCol, 0.3)

        let borderColor = '#2a2a2e'
        if (isHover) borderColor = '#8a6fd6'
        else if (inSel) borderColor = '#4a9fff'
        else if (isMirror) borderColor = 'rgba(138,111,214,0.5)'
        else if (isHL) borderColor = '#f0c96a'

        const shadow = isHover ? '0 0 0 2px #8a6fd6' : inSel ? '0 0 0 1px #4a9fff' : 'none'

        out.push({ key, x, z, bgColor, tex, shadow, borderColor, tagId })
      }
    }
    return out
  }, [blueprint, ghostBlueprint, activeLayer, showGhost, selection, hoverCell,
      symmetryX, symmetryZ, GX, GZ, textureMap, tags, showTagMarkers, highlightBlock])

  if (!blueprint) return null

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'auto' }}
    >
      {/* Centering wrapper: expands to at least fill the scroll viewport so the
          grid stays centered when small, and lets it overflow (scroll) when large */}
      <div style={{
        minWidth: '100%', minHeight: '100%',
        boxSizing: 'border-box', padding: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div
          onMouseUp={onGridUp}
          onMouseLeave={onGridLeave}
          style={{
            flexShrink: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${GX}, ${cellSize}px)`,
            gap: GAP,
            background: '#0d0d0f',
            padding: PAD,
            borderRadius: 3,
            userSelect: 'none',
          }}
        >
          {cells.map((cell) => (
            <div
              key={cell.key}
              onMouseDown={() => onCellDown(cell.x, cell.z)}
              onMouseEnter={() => onCellEnter(cell.x, cell.z)}
              style={{
                width: cellSize, height: cellSize, position: 'relative', cursor: 'pointer',
                background: cell.bgColor,
                backgroundImage: cell.tex ? `url(${cell.tex})` : 'repeating-linear-gradient(45deg,rgba(0,0,0,.08) 0 3px,transparent 3px 6px)',
                backgroundSize: cell.tex ? 'cover' : undefined,
                imageRendering: 'pixelated',
                border: `1px solid ${cell.borderColor}`,
                boxShadow: cell.shadow,
                boxSizing: 'border-box',
                borderRadius: 1,
              }}
            >
              {cell.tagId && cellSize >= 14 && (
                <div style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: Math.round(cellSize * 0.4), height: Math.round(cellSize * 0.4), borderRadius: 3,
                  background: tagColor(cell.tagId), color: '#161616',
                  fontSize: Math.max(6, Math.round(cellSize * 0.27)), fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tagLetter(cell.tagId)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        display: 'flex', alignItems: 'center', gap: 2,
        background: 'rgba(13,13,15,0.75)', border: '1px solid #2c2c30',
        borderRadius: 7, padding: '3px 5px',
        backdropFilter: 'blur(4px)',
      }}>
        {(['−', '·', '+'] as const).map((label) => (
          <button
            key={label}
            onClick={() => {
              if (label === '−') setUserZoom((p) => Math.max(p / 1.3, 0.25))
              else if (label === '+') setUserZoom((p) => Math.min(p * 1.3, 6))
              else setUserZoom(1)
            }}
            title={label === '·' ? 'Reset zoom' : label === '+' ? 'Zoom in (Ctrl+scroll)' : 'Zoom out (Ctrl+scroll)'}
            style={{
              border: 'none', borderRadius: 5, width: label === '·' ? 'auto' : 22, height: 22,
              padding: label === '·' ? '0 6px' : 0,
              background: label === '·' ? 'transparent' : '#232326',
              color: label === '·' ? '#8a8892' : '#c8c6cf',
              fontSize: label === '·' ? 10.5 : 14, fontWeight: label === '·' ? 400 : 700,
              cursor: 'pointer', lineHeight: 1,
            }}
          >
            {label === '·' ? `${Math.round(autoFitScale * userZoom * 100)}%` : label}
          </button>
        ))}
      </div>
    </div>
  )
}
