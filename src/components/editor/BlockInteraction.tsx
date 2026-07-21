import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'

/** Returns the mirrored positions for a given (x,y,z) based on symmetry settings */
function getMirrorPositions(
  x: number, y: number, z: number,
  sizeX: number, sizeZ: number,
  symX: boolean, symZ: boolean,
): Array<{ x: number; y: number; z: number }> {
  const positions: Array<{ x: number; y: number; z: number }> = [{ x, y, z }]
  const mx = sizeX - 1 - x
  const mz = sizeZ - 1 - z
  if (symX && mx !== x) positions.push({ x: mx, y, z })
  if (symZ && mz !== z) positions.push({ x, y, z: mz })
  if (symX && symZ && mx !== x && mz !== z) positions.push({ x: mx, y, z: mz })
  return positions
}

/**
 * Invisible plane used for raycasting when no block face is hit.
 * Sits at Y=0 so blocks can be placed on the ground.
 */
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

/**
 * Hook that handles all pointer events on the 3D canvas and maps them to
 * blueprint mutations based on the current tool mode.
 */
export function useBlockInteraction() {
  const { raycaster, camera, scene } = useThree()
  const paintVisited = useRef(new Set<string>())
  const isPainting = useRef(false)

  const tool = useEditorStore((s) => s.tool)
  const selectedBlockName = useEditorStore((s) => s.selectedBlockName)
  const symmetryX = useEditorStore((s) => s.symmetryX)
  const symmetryZ = useEditorStore((s) => s.symmetryZ)
  const setHoverPos = useEditorStore((s) => s.setHoverPos)
  const setSelectedPos = useEditorStore((s) => s.setSelectedPos)
  const setTagTargetPos = useEditorStore((s) => s.setTagTargetPos)
  const dragging = useEditorStore((s) => s.dragging)
  const setDragging = useEditorStore((s) => s.setDragging)

  const blueprint = useBlueprintStore((s) => s.blueprint)
  const ghostBlueprint = useBlueprintStore((s) => s.ghostBlueprint)
  const setBlocks = useBlueprintStore((s) => s.setBlocks)
  const ensurePaletteEntry = useBlueprintStore((s) => s.ensurePaletteEntry)

  const getRaycastPos = useCallback(
    (event: PointerEvent | MouseEvent): { x: number; y: number; z: number; isGhost: boolean } | null => {
      if (!blueprint) return null

      const canvas = (event.target as HTMLElement).closest('canvas')
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

      // Collect all meshes in scene
      const meshes: THREE.Object3D[] = []
      scene.traverse((obj) => {
        if (obj instanceof THREE.InstancedMesh) meshes.push(obj)
      })

      const hits = raycaster.intersectObjects(meshes, false)
      if (hits.length > 0) {
        const hit = hits[0]
        const isGhost = (hit.object.userData.isGhost as boolean) ?? false
        // The face normal tells us which face was hit; offset to get the block position
        const normal = hit.face?.normal ?? new THREE.Vector3(0, 1, 0)
        const point = hit.point.clone()
        if (!isGhost) {
          // Place on the face of the block (add offset in normal direction)
          point.addScaledVector(normal, tool === 'erase' ? -0.5 : 0.5)
        }
        return {
          x: Math.floor(point.x),
          y: Math.floor(point.y),
          z: Math.floor(point.z),
          isGhost,
        }
      }

      // Fall back to ground plane
      const groundPoint = new THREE.Vector3()
      raycaster.ray.intersectPlane(GROUND_PLANE, groundPoint)
      if (groundPoint) {
        return {
          x: Math.floor(groundPoint.x),
          y: 0,
          z: Math.floor(groundPoint.z),
          isGhost: false,
        }
      }
      return null
    },
    [raycaster, camera, scene, blueprint, tool],
  )

  const applyAtPos = useCallback(
    (x: number, y: number, z: number, isGhost: boolean) => {
      if (!blueprint) return
      const { sizeX, sizeY, sizeZ } = blueprint

      if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) return

      if (isGhost && tool !== 'erase') {
        // Stamp from ghost: copy ghost block into active at this position (if active is air)
        const activeIdx = blueprint.structure[y]?.[z]?.[x] ?? 0
        if (activeIdx !== 0) return
        const ghostIdx = ghostBlueprint?.structure[y]?.[z]?.[x] ?? 0
        if (ghostIdx === 0) return
        const ghostBlock = ghostBlueprint!.palette[ghostIdx]
        if (!ghostBlock || ghostBlock.name === 'minecraft:air') return
        const paletteIndex = ensurePaletteEntry(ghostBlock.name, ghostBlock.properties)
        const entries = getMirrorPositions(x, y, z, sizeX, sizeZ, symmetryX, symmetryZ).map(
          (p) => ({ ...p, paletteIndex }),
        )
        setBlocks(entries)
        return
      }

      if (tool === 'place' || tool === 'paint') {
        const paletteIndex = ensurePaletteEntry(selectedBlockName)
        const entries = getMirrorPositions(x, y, z, sizeX, sizeZ, symmetryX, symmetryZ).map(
          (p) => ({ ...p, paletteIndex }),
        )
        setBlocks(entries)
      } else if (tool === 'erase') {
        const entries = getMirrorPositions(x, y, z, sizeX, sizeZ, symmetryX, symmetryZ).map(
          (p) => ({ ...p, paletteIndex: 0 }),
        )
        setBlocks(entries)
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
      blueprint, ghostBlueprint, tool, selectedBlockName,
      symmetryX, symmetryZ, setBlocks, ensurePaletteEntry,
      setTagTargetPos, setSelectedPos,
    ],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const pos = getRaycastPos(event)
      setHoverPos(pos ? { x: pos.x, y: pos.y, z: pos.z } : null)

      if (isPainting.current && tool === 'paint' && pos) {
        const key = `${pos.x},${pos.y},${pos.z}`
        if (!paintVisited.current.has(key)) {
          paintVisited.current.add(key)
          applyAtPos(pos.x, pos.y, pos.z, pos.isGhost)
        }
      }
    },
    [getRaycastPos, setHoverPos, tool, applyAtPos],
  )

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return

      // If dragging a block from palette, place it
      if (dragging) {
        const pos = getRaycastPos(event)
        if (pos) {
          const paletteIndex = ensurePaletteEntry(dragging.blockName)
          if (blueprint) {
            const { sizeX, sizeZ } = blueprint
            const entries = getMirrorPositions(pos.x, pos.y, pos.z, sizeX, sizeZ, symmetryX, symmetryZ).map(
              (p) => ({ ...p, paletteIndex }),
            )
            setBlocks(entries)
          }
          setDragging(null)
        }
        return
      }

      if (tool === 'paint') {
        isPainting.current = true
        paintVisited.current.clear()
        const pos = getRaycastPos(event)
        if (pos) {
          paintVisited.current.add(`${pos.x},${pos.y},${pos.z}`)
          applyAtPos(pos.x, pos.y, pos.z, pos.isGhost)
        }
        return
      }

      const pos = getRaycastPos(event)
      if (pos) applyAtPos(pos.x, pos.y, pos.z, pos.isGhost)
    },
    [
      dragging, getRaycastPos, ensurePaletteEntry, blueprint,
      symmetryX, symmetryZ, setBlocks, setDragging,
      tool, applyAtPos,
    ],
  )

  const onPointerUp = useCallback(() => {
    isPainting.current = false
    paintVisited.current.clear()
  }, [])

  return { onPointerMove, onPointerDown, onPointerUp }
}
