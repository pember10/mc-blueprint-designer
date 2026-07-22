import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'

const BOX_GEO = new THREE.BoxGeometry(1, 1, 1)

/**
 * Renders the N-1 ghost blueprint as semi-transparent blue-tinted blocks.
 *
 * Ghost blocks are skipped at positions that already have a non-air block
 * in the active blueprint (no visual clutter where blocks already exist).
 *
 * Blocks in the ghost are clickable (stamp interaction — handled in BlockInteraction).
 */
export default function GhostVoxelGrid({ allLayers = false }: { allLayers?: boolean }) {
  const ghostBlueprint = useBlueprintStore((s) => s.ghostBlueprint)
  const activeBlueprint = useBlueprintStore((s) => s.blueprint)
  const showGhost = useEditorStore((s) => s.showGhost)
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const GHOST_OPACITY = 0.35

  const groups = useMemo(() => {
    if (!ghostBlueprint || !showGhost) return new Map<number, THREE.Vector3[]>()
    const map = new Map<number, THREE.Vector3[]>()
    const { structure, sizeX, sizeY, sizeZ } = ghostBlueprint
    const maxY = allLayers ? sizeY - 1 : Math.min(activeLayer, sizeY - 1)
    for (let y = 0; y <= maxY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          const ghostIdx = structure[y]?.[z]?.[x] ?? 0
          if (ghostIdx === 0) continue

          const ghostBlock = ghostBlueprint.palette[ghostIdx]?.name ?? 'minecraft:air'
          if (ghostBlock === 'minecraft:air') continue

          // Skip if active blueprint already has a non-air block here
          const activeIdx = activeBlueprint?.structure[y]?.[z]?.[x] ?? 0
          if (activeIdx !== 0) continue

          const positions = map.get(ghostIdx) ?? []
          positions.push(new THREE.Vector3(x, y, z))
          map.set(ghostIdx, positions)
        }
      }
    }
    return map
  }, [ghostBlueprint, activeBlueprint, showGhost, activeLayer, allLayers])

  if (!ghostBlueprint || !showGhost) return null

  return (
    <>
      {[...groups.entries()].map(([paletteIdx, positions]) => {
        const blockName = ghostBlueprint.palette[paletteIdx]?.name ?? 'minecraft:air'
        return (
          <GhostInstancedMesh
            key={paletteIdx}
            positions={positions}
            blockName={blockName}
            opacity={GHOST_OPACITY}
          />
        )
      })}
    </>
  )
}

interface GhostInstancedMeshProps {
  positions: THREE.Vector3[]
  blockName: string
  opacity: number
}

function GhostInstancedMesh({ positions, opacity }: GhostInstancedMeshProps) {
  const mesh = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0x3388ff),
      transparent: true,
      opacity,
      depthWrite: false,
    })
    const im = new THREE.InstancedMesh(BOX_GEO, mat, positions.length)
    im.userData.isGhost = true
    const dummy = new THREE.Object3D()
    positions.forEach((pos, i) => {
      dummy.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
    })
    im.instanceMatrix.needsUpdate = true
    return im
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, opacity])

  useEffect(() => () => (mesh.material as THREE.Material).dispose(), [mesh])

  return <primitive object={mesh} />
}
