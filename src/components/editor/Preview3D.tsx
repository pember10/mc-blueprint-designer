import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import VoxelGrid from './VoxelGrid'
import GhostVoxelGrid from './GhostVoxelGrid'

interface Preview3DProps {
  /** Canvas height in px */
  height?: number
}

/**
 * Interactive 3D preview of the current blueprint level.
 * Uses R3F with free OrbitControls (orbit, zoom, pan) — no editing conflict
 * since all editing happens in the 2D LayerGrid.
 */
export default function Preview3D({ height = 170 }: Preview3DProps) {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const ghostBlueprint = useBlueprintStore((s) => s.ghostBlueprint)
  const showGhost = useEditorStore((s) => s.showGhost)

  if (!blueprint) return null

  const cx = blueprint.sizeX / 2
  const cy = blueprint.sizeY / 2
  const cz = blueprint.sizeZ / 2
  const dist = Math.max(blueprint.sizeX, blueprint.sizeY, blueprint.sizeZ) * 1.5

  return (
    <Canvas
      style={{ height, width: '100%', background: 'transparent' }}
      camera={{ position: [cx + dist, cy + dist * 0.6, cz + dist], fov: 35 }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 16, 8]} intensity={0.8} castShadow />
      <Suspense fallback={null}>
        <VoxelGrid allLayers />
        {showGhost && ghostBlueprint && <GhostVoxelGrid allLayers />}
      </Suspense>
      <OrbitControls makeDefault enablePan enableZoom enableRotate />
    </Canvas>
  )
}
