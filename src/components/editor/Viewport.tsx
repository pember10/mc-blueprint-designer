import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import VoxelGrid from './VoxelGrid'
import GhostVoxelGrid from './GhostVoxelGrid'
import Stage from './Stage'
import { useBlockInteraction } from './BlockInteraction'
import { useBlueprintStore } from '@/store/blueprintStore'

function Scene() {
  const { onPointerMove, onPointerDown, onPointerUp } = useBlockInteraction()

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <Stage />
      <VoxelGrid />
      <GhostVoxelGrid />
      {/* Transparent hit-plane for pointer events */}
      <mesh
        visible={false}
        onPointerMove={(e) => onPointerMove(e.nativeEvent)}
        onPointerDown={(e) => onPointerDown(e.nativeEvent)}
        onPointerUp={() => onPointerUp()}
        position={[0, -0.1, 0]}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  )
}

export default function Viewport() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const cx = blueprint ? blueprint.sizeX / 2 : 8
  const cz = blueprint ? blueprint.sizeZ / 2 : 8
  const cy = blueprint ? blueprint.sizeY / 2 : 4

  return (
    <Canvas
      shadows
      camera={{ position: [cx + 20, cy + 20, cz + 20], fov: 50, near: 0.1, far: 1000 }}
      className="w-full h-full"
    >
      <OrbitControls target={[cx, cy, cz]} makeDefault />
      <Scene />
    </Canvas>
  )
}
