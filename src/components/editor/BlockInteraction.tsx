import { useRef, useCallback } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'

function getMirrorPositions(
  x: number, y: number, z: number,
  sizeX: number, sizeZ: number,
  symX: boolean, symZ: boolean,
): Array<{ x: number; y: number; z: number }> {
  const mx = sizeX - 1 - x
  const mz = sizeZ - 1 - z
  const out = [{ x, y, z }]
  if (symX && mx !== x) out.push({ x: mx, y, z })
  if (symZ && mz !== z) out.push({ x, y, z: mz })
  if (symX && symZ && mx !== x && mz !== z) out.push({ x: mx, y, z: mz })
  return out
}

/**
 * Returns R3F event handlers to attach to the invisible interaction plane.
 *
 * Non-paint tools: apply only on pointer-up when drag distance < 5 px
 * (so left-drag for orbit doesn't accidentally place blocks).
 * Paint tool: apply continuously while the pointer button is held.
 */
export function useBlockInteraction() {
  const isPainting = useRef(false)
  const paintVisited = useRef(new Set<string>())
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const tool = useEditorStore((s) => s.tool)
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const selectedBlockName = useEditorStore((s) => s.selectedBlockName)
  const symmetryX = useEditorStore((s) => s.symmetryX)
  const symmetryZ = useEditorStore((s) => s.symmetryZ)
  const setHoverPos = useEditorStore((s) => s.setHoverPos)
  const setSelectedPos = useEditorStore((s) => s.setSelectedPos)
  const setTagTargetPos = useEditorStore((s) => s.setTagTargetPos)
  const dragging = useEditorStore((s) => s.dragging)
  const setDragging = useEditorStore((s) => s.setDragging)

  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setBlocks = useBlueprintStore((s) => s.setBlocks)
  const ensurePaletteEntry = useBlueprintStore((s) => s.ensurePaletteEntry)

  const applyAt = useCallback(
    (x: number, z: number) => {
      if (!blueprint) return
      const y = activeLayer
      const { sizeX, sizeY, sizeZ } = blueprint
      if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) return

      if (tool === 'place' || tool === 'paint') {
        const paletteIndex = ensurePaletteEntry(selectedBlockName)
        setBlocks(
          getMirrorPositions(x, y, z, sizeX, sizeZ, symmetryX, symmetryZ).map((p) => ({
            ...p,
            paletteIndex,
          })),
        )
      } else if (tool === 'erase') {
        setBlocks(
          getMirrorPositions(x, y, z, sizeX, sizeZ, symmetryX, symmetryZ).map((p) => ({
            ...p,
            paletteIndex: 0,
          })),
        )
      } else if (tool === 'pick') {
        const idx = blueprint.structure[y]?.[z]?.[x] ?? 0
        const name = blueprint.palette[idx]?.name
        if (name && name !== 'minecraft:air') {
          useEditorStore.getState().setSelectedBlock(name)
          useEditorStore.getState().setTool('place')
        }
      } else if (tool === 'tag') {
        setTagTargetPos({ x, y, z })
      } else if (tool === 'select') {
        setSelectedPos({ x, y, z })
      }
    },
    [
      blueprint, activeLayer, tool, selectedBlockName,
      symmetryX, symmetryZ, setBlocks, ensurePaletteEntry,
      setTagTargetPos, setSelectedPos,
    ],
  )

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const x = Math.floor(e.point.x)
      const z = Math.floor(e.point.z)
      setHoverPos({ x, y: activeLayer, z })

      if (isPainting.current) {
        const key = `${x},${activeLayer},${z}`
        if (!paintVisited.current.has(key)) {
          paintVisited.current.add(key)
          applyAt(x, z)
        }
      }
    },
    [activeLayer, setHoverPos, applyAt],
  )

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return

      dragStart.current = { x: e.clientX, y: e.clientY }

      // Drop a block dragged from the palette
      if (dragging && blueprint) {
        const x = Math.floor(e.point.x)
        const z = Math.floor(e.point.z)
        const { sizeX, sizeZ } = blueprint
        const paletteIndex = ensurePaletteEntry(dragging.blockName)
        setBlocks(
          getMirrorPositions(x, activeLayer, z, sizeX, sizeZ, symmetryX, symmetryZ).map((p) => ({
            ...p,
            paletteIndex,
          })),
        )
        setDragging(null)
        return
      }

      if (tool === 'paint') {
        isPainting.current = true
        paintVisited.current.clear()
        const x = Math.floor(e.point.x)
        const z = Math.floor(e.point.z)
        paintVisited.current.add(`${x},${activeLayer},${z}`)
        applyAt(x, z)
      }
    },
    [
      blueprint, activeLayer, dragging, tool,
      symmetryX, symmetryZ, setBlocks, ensurePaletteEntry,
      setDragging, applyAt,
    ],
  )

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return

      const wasPainting = isPainting.current
      isPainting.current = false
      paintVisited.current.clear()

      if (dragging || wasPainting) {
        dragStart.current = null
        return
      }

      // Click = pointer-up within 5 px of pointer-down
      if (dragStart.current) {
        const dx = e.clientX - dragStart.current.x
        const dy = e.clientY - dragStart.current.y
        if (Math.sqrt(dx * dx + dy * dy) < 5) {
          applyAt(Math.floor(e.point.x), Math.floor(e.point.z))
        }
      }
      dragStart.current = null
    },
    [dragging, applyAt],
  )

  const onPointerLeave = useCallback(() => {
    setHoverPos(null)
    isPainting.current = false
    paintVisited.current.clear()
    dragStart.current = null
  }, [setHoverPos])

  return { onPointerMove, onPointerDown, onPointerUp, onPointerLeave }
}
