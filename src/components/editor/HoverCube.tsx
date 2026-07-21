import { useMemo } from 'react'
import * as THREE from 'three'
import { useEditorStore } from '@/store/editorStore'
import { useBlueprintStore } from '@/store/blueprintStore'
import { resolveColorSync } from '@/lib/blocks/textures'

const HOVER_GEO = new THREE.BoxGeometry(1.03, 1.03, 1.03)

/**
 * Renders a semi-transparent block at the current hover position (and symmetry
 * mirrors) so the user can see exactly where the next action will land.
 *
 * - Place / Paint: tinted in the selected block's colour
 * - Erase: red tint
 * - Other tools: white tint
 */
export default function HoverCube() {
  const hoverPos = useEditorStore((s) => s.hoverPos)
  const selectedBlockName = useEditorStore((s) => s.selectedBlockName)
  const symmetryX = useEditorStore((s) => s.symmetryX)
  const symmetryZ = useEditorStore((s) => s.symmetryZ)
  const tool = useEditorStore((s) => s.tool)
  const blueprint = useBlueprintStore((s) => s.blueprint)

  const placeMat = useMemo(() => {
    const c = resolveColorSync(selectedBlockName)
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(c),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  }, [selectedBlockName])

  const eraseMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ff3333'),
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    [],
  )

  if (!hoverPos) return null

  const mat = tool === 'erase' ? eraseMat : placeMat

  // Collect all positions to show (primary + symmetry mirrors)
  const positions: Array<{ x: number; y: number; z: number }> = [hoverPos]
  if (blueprint) {
    const { sizeX, sizeZ } = blueprint
    const mx = sizeX - 1 - hoverPos.x
    const mz = sizeZ - 1 - hoverPos.z
    if (symmetryX && mx !== hoverPos.x) positions.push({ x: mx, y: hoverPos.y, z: hoverPos.z })
    if (symmetryZ && mz !== hoverPos.z) positions.push({ x: hoverPos.x, y: hoverPos.y, z: mz })
    if (symmetryX && symmetryZ && mx !== hoverPos.x && mz !== hoverPos.z)
      positions.push({ x: mx, y: hoverPos.y, z: mz })
  }

  return (
    <>
      {positions.map((p, i) => (
        <mesh
          key={i}
          position={[p.x + 0.5, p.y + 0.5, p.z + 0.5]}
          geometry={HOVER_GEO}
          material={mat}
          renderOrder={1}
        />
      ))}
    </>
  )
}
