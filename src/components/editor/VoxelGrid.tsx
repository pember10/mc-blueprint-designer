import { useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { resolveColorSync } from '@/lib/blocks/textures'
import { resolveBlockstate } from '@/lib/blocks/blockstate'
import { resolveModel } from '@/lib/blocks/model'
import { buildBlockMesh, tickAnimatedTextures, type BlockMesh } from '@/lib/blocks/geometry'

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

  // Advance animated textures (lava, water, fire, portals, etc.) each frame
  useFrame((_, delta) => tickAnimatedTextures(delta * 1000))

  // Bump this to trigger a re-render when the async mesh cache gets new entries
  const [cacheVersion, setCacheVersion] = useState(0)

  // Kick off async model loading for any uncached palette entries
  useEffect(() => {
    if (!blueprint || !modelDataLoaded) return

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

          const mesh = await buildBlockMesh(model, variant.xRot, variant.yRot)
          meshCache.set(name, mesh)
          setCacheVersion((v) => v + 1)
        } catch {
          // Don't permanently cache failures — allows retry on next cacheVersion bump.
          // Permanent nulls (unsupported blockstates) are already set above via early returns.
        } finally {
          pending.delete(name)
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
        // THREE.Color doesn't handle 'transparent'; fall back to grey for
        // cross-model blocks (flowers etc.) that have no registered opaque color.
        const safeColor = !color || color === 'transparent' ? '#888888' : color
        return (
          <InstancedBlockMesh
            key={`${paletteIdx}-color`}
            positions={positions}
            color={safeColor}
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

  // One InstancedMesh per unique material. Groups sharing the same material
  // are merged into a single copied BufferGeometry so that no geometry object
  // is shared between meshes (sharing breaks because drawRange is per-geometry,
  // not per-mesh, causing last-write-wins occlusion artifacts).
  const meshes = useMemo(() => {
    const posAttr = geometry.attributes.position as THREE.BufferAttribute
    const uvAttr  = geometry.attributes.uv       as THREE.BufferAttribute
    const normAttr = geometry.attributes.normal  as THREE.BufferAttribute

    // Accumulate vertex ranges per material index
    const byMat = new Map<number, Array<{ start: number; count: number }>>()
    for (const g of geometry.groups) {
      const mi = g.materialIndex ?? 0
      const list = byMat.get(mi) ?? []
      list.push({ start: g.start, count: g.count })
      byMat.set(mi, list)
    }

    const dummy = new THREE.Object3D()
    const result: THREE.InstancedMesh[] = []

    for (const [mi, ranges] of byMat) {
      const totalVerts = ranges.reduce((s, r) => s + r.count, 0)
      const pos  = new Float32Array(totalVerts * 3)
      const uvs  = new Float32Array(totalVerts * 2)
      const norm = new Float32Array(totalVerts * 3)

      let offset = 0
      for (const { start, count } of ranges) {
        pos.set( (posAttr.array  as Float32Array).subarray(start * 3, (start + count) * 3), offset * 3)
        uvs.set( (uvAttr.array   as Float32Array).subarray(start * 2, (start + count) * 2), offset * 2)
        norm.set((normAttr.array as Float32Array).subarray(start * 3, (start + count) * 3), offset * 3)
        offset += count
      }

      const slice = new THREE.BufferGeometry()
      slice.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      slice.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2))
      slice.setAttribute('normal',   new THREE.Float32BufferAttribute(norm, 3))

      const mat = materials[mi] ?? materials[0]
      const im = new THREE.InstancedMesh(slice, mat, positions.length)
      positions.forEach((p, i) => {
        // Model geometry is in 0-1 space; translate to grid position directly (no +0.5 offset)
        dummy.position.set(p.x, p.y, p.z)
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
    () => () => { for (const m of meshes) m.geometry.dispose() },
    [meshes],
  )

  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>
}


