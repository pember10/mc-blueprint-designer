import { useMemo } from 'react'
import * as THREE from 'three'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { resolveColorSync } from '@/lib/blocks/textures'

const BOX_GEO = new THREE.BoxGeometry(1, 1, 1)

/**
 * Renders all non-air blocks in the active blueprint using one
 * InstancedMesh per unique palette entry (for performance).
 *
 * Only renders blocks at Y <= activeLayer.
 */
export default function VoxelGrid() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const activeLayer = useEditorStore((s) => s.activeLayer)

  // Group positions by palette index
  const groups = useMemo(() => {
    if (!blueprint) return new Map<number, THREE.Vector3[]>()
    const map = new Map<number, THREE.Vector3[]>()
    const { structure, sizeX, sizeY, sizeZ } = blueprint
    for (let y = 0; y <= Math.min(activeLayer, sizeY - 1); y++) {
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          const idx = structure[y]?.[z]?.[x] ?? 0
          if (idx === 0) continue // air
          const blockName = blueprint.palette[idx]?.name ?? 'minecraft:air'
          if (blockName === 'minecraft:air') continue
          const positions = map.get(idx) ?? []
          positions.push(new THREE.Vector3(x, y, z))
          map.set(idx, positions)
        }
      }
    }
    return map
  }, [blueprint, activeLayer])

  if (!blueprint) return null

  return (
    <>
      {[...groups.entries()].map(([paletteIdx, positions]) => {
        const blockName = blueprint.palette[paletteIdx]?.name ?? 'minecraft:air'
        const color = resolveColorSync(blockName)
        return (
          <InstancedBlockMesh
            key={paletteIdx}
            positions={positions}
            color={color}
          />
        )
      })}
    </>
  )
}

interface InstancedBlockMeshProps {
  positions: THREE.Vector3[]
  color: string
}

function InstancedBlockMesh({ positions, color }: InstancedBlockMeshProps) {
  const mesh = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) })
    const im = new THREE.InstancedMesh(BOX_GEO, mat, positions.length)
    const dummy = new THREE.Object3D()
    positions.forEach((pos, i) => {
      dummy.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
    })
    im.instanceMatrix.needsUpdate = true
    im.castShadow = true
    im.receiveShadow = true
    return im
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, color])

  return <primitive object={mesh} />
}
