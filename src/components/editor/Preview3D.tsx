import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import VoxelGrid from './VoxelGrid'
import GhostVoxelGrid from './GhostVoxelGrid'

interface Preview3DProps {
  /** Canvas height — px number or CSS string e.g. '100%' */
  height?: number | string
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
  const hoverCell = useEditorStore((s) => s.hoverCell)
  const activeLayer = useEditorStore((s) => s.activeLayer)

  if (!blueprint) return null

  const { sizeX, sizeY, sizeZ } = blueprint
  const cx = sizeX / 2
  const cz = sizeZ / 2
  const dist = Math.max(sizeX, sizeY, sizeZ) * 1.5
  // Initial camera looks at the active layer from a diagonal above
  const camY = activeLayer + dist * 0.6
  const gridSz = Math.max(sizeX, sizeZ)

  return (
    <Canvas
      style={{ height, width: '100%', background: 'transparent' }}
      camera={{ position: [cx + dist, camY, cz + dist], fov: 35 }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 16, 8]} intensity={0.8} castShadow />
      <Suspense fallback={null}>
        <VoxelGrid allLayers />
        {showGhost && ghostBlueprint && <GhostVoxelGrid allLayers />}
      </Suspense>

      {/* Ground grid */}
      <gridHelper
        args={[gridSz, gridSz, '#2e2e3a', '#222230']}
        position={[cx, -0.501, cz]}
      />

      {/* Footprint outline at Y=0 so the building footprint is clear */}
      <mesh position={[cx, -0.5, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sizeX, sizeZ]} />
        <meshBasicMaterial color="#1a1a28" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* Active-layer indicator plane */}
      <mesh position={[cx, activeLayer, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sizeX, sizeZ]} />
        <meshBasicMaterial color="#8a6fd6" transparent opacity={0.06} depthWrite={false} />
      </mesh>

      {/* Cursor position (mirrors 2D hoverCell) */}
      {hoverCell && (
        <mesh position={[hoverCell.x + 0.5, activeLayer + 0.5, hoverCell.z + 0.5]}>
          <boxGeometry args={[1.04, 1.04, 1.04]} />
          <meshBasicMaterial color="#8a6fd6" wireframe />
        </mesh>
      )}

      <OrbitControls makeDefault enablePan enableZoom enableRotate target={[cx, activeLayer, cz]} />
    </Canvas>
  )
}
