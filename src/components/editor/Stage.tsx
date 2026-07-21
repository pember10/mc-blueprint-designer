import { useMemo } from 'react'
import * as THREE from 'three'
import { useBlueprintStore } from '@/store/blueprintStore'
import { resolveColorSync } from '@/lib/blocks/textures'

/**
 * The platform the blueprint sits on — a flat mesh slightly larger than the
 * blueprint footprint, with a grid overlay.
 */
export default function Stage() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const { sizeX = 1, sizeZ = 1 } = blueprint ?? {}

  const pad = 2
  const w = sizeX + pad * 2
  const d = sizeZ + pad * 2

  const platformMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(resolveColorSync('minecraft:oak_planks')),
      }),
    [],
  )

  const centerX = sizeX / 2
  const centerZ = sizeZ / 2

  return (
    <group>
      {/* Platform */}
      <mesh
        position={[centerX, -0.5, centerZ]}
        receiveShadow
        material={platformMat}
      >
        <boxGeometry args={[w, 0.2, d]} />
      </mesh>

      {/* Grid helper */}
      <gridHelper
        args={[Math.max(w, d), Math.max(w, d), '#555555', '#333333']}
        position={[centerX, 0.01, centerZ]}
      />
    </group>
  )
}
