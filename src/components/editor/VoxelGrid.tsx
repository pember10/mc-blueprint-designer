import { useMemo, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { resolveColorSync } from '@/lib/blocks/textures'
import { resolveBlockstate } from '@/lib/blocks/blockstate'
import { resolveModel } from '@/lib/blocks/model'
import { buildBlockMesh, type BlockMesh } from '@/lib/blocks/geometry'

const BOX_GEO = new THREE.BoxGeometry(1, 1, 1)

// Module-level mesh cache keyed by full blockstate string.
// null = attempted but no model data available (use colored cube fallback).
const meshCache = new Map<string, BlockMesh | null>()
// Track in-flight loads so we don't kick off duplicate async chains
const pending = new Set<string>()

/**
 * Renders all non-air blocks in the active blueprint using one
 * InstancedMesh per unique palette entry (for performance).
 *
 * Only renders blocks at Y <= activeLayer, unless allLayers=true.
 */
export default function VoxelGrid({ allLayers = false }: { allLayers?: boolean }) {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const modelDataLoaded = useEditorStore((s) => s.modelDataLoaded)
  const textureMap = useEditorStore((s) => s.textureMap)

  // Bump this to trigger a re-render when the async mesh cache gets new entries
  const [cacheVersion, setCacheVersion] = useState(0)

  // Keep a stable ref for textureMap so the async effects can read the latest value
  const textureMapRef = useRef(textureMap)
  useEffect(() => { textureMapRef.current = textureMap }, [textureMap])

  // Kick off async model loading for any uncached palette entries
  useEffect(() => {
    if (!blueprint || !modelDataLoaded) return
    let dirty = false

    for (const entry of blueprint.palette) {
      const name = entry.name
      if (name === 'minecraft:air') continue
      if (meshCache.has(name) || pending.has(name)) continue

      pending.add(name)
      ;(async () => {
        try {
          const variant = await resolveBlockstate(name)
          if (!variant) { meshCache.set(name, null); return }

          const model = await resolveModel(variant.modelId)
          if (!model) { meshCache.set(name, null); return }

          const mesh = buildBlockMesh(model, textureMapRef.current, variant.xRot, variant.yRot)
          meshCache.set(name, mesh)
          dirty = true
        } catch {
          meshCache.set(name, null)
        } finally {
          pending.delete(name)
          if (dirty) setCacheVersion((v) => v + 1)
        }
      })()
    }
  }, [blueprint, modelDataLoaded, cacheVersion])

  // Group positions by palette index
  const groups = useMemo(() => {
    if (!blueprint) return new Map<number, THREE.Vector3[]>()
    const map = new Map<number, THREE.Vector3[]>()
    const { structure, sizeX, sizeY, sizeZ } = blueprint
    const maxY = allLayers ? sizeY - 1 : Math.min(activeLayer, sizeY - 1)
    for (let y = 0; y <= maxY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          const idx = structure[y]?.[z]?.[x] ?? 0
          if (idx === 0) continue
          const blockName = blueprint.palette[idx]?.name ?? 'minecraft:air'
          if (blockName === 'minecraft:air') continue
          const positions = map.get(idx) ?? []
          positions.push(new THREE.Vector3(x, y, z))
          map.set(idx, positions)
        }
      }
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint, activeLayer, allLayers, cacheVersion])

  if (!blueprint) return null

  return (
    <>
      {[...groups.entries()].map(([paletteIdx, positions]) => {
        const blockName = blueprint.palette[paletteIdx]?.name ?? 'minecraft:air'
        const blockMesh = meshCache.get(blockName) ?? null

        if (blockMesh) {
          return (
            <InstancedModelMesh
              key={`${paletteIdx}-model`}
              positions={positions}
              blockMesh={blockMesh}
            />
          )
        }

        const color = resolveColorSync(blockName)
        return (
          <InstancedBlockMesh
            key={`${paletteIdx}-color`}
            positions={positions}
            color={color}
          />
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Colored-cube fallback (same as before)
// ---------------------------------------------------------------------------

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

  useEffect(() => () => (mesh.material as THREE.Material).dispose(), [mesh])

  return <primitive object={mesh} />
}

// ---------------------------------------------------------------------------
// Model-based instanced renderer
// ---------------------------------------------------------------------------

interface InstancedModelMeshProps {
  positions: THREE.Vector3[]
  blockMesh: BlockMesh
}

function InstancedModelMesh({ positions, blockMesh }: InstancedModelMeshProps) {
  const { geometry, materials } = blockMesh

  // One InstancedMesh per material group. We composite them by rendering each
  // group's triangles as its own InstancedMesh with the correct material.
  const meshes = useMemo(() => {
    const dummy = new THREE.Object3D()
    const result: THREE.InstancedMesh[] = []

    for (let gi = 0; gi < geometry.groups.length; gi++) {
      const g = geometry.groups[gi]
      const mat = materials[g.materialIndex ?? 0] ?? materials[0]

      // Build a geometry slice for this group only
      const slice = new THREE.BufferGeometry()
      slice.setAttribute('position', geometry.attributes.position)
      slice.setAttribute('uv', geometry.attributes.uv)
      slice.setAttribute('normal', geometry.attributes.normal)
      slice.setDrawRange(g.start, g.count)

      const im = new THREE.InstancedMesh(slice, mat, positions.length)
      positions.forEach((pos, i) => {
        dummy.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
        dummy.updateMatrix()
        im.setMatrixAt(i, dummy.matrix)
      })
      im.instanceMatrix.needsUpdate = true
      result.push(im)
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, blockMesh])

  useEffect(
    () => () => { for (const m of meshes) { if (m.geometry !== geometry) m.geometry.dispose() } },
    [meshes, geometry],
  )

  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>
}

