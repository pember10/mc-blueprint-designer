import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import VoxelGrid from './VoxelGrid'
import GhostVoxelGrid from './GhostVoxelGrid'
import HoverCube from './HoverCube'
import Stage from './Stage'
import { useBlockInteraction } from './BlockInteraction'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'

/**
 * Invisible horizontal plane at y = activeLayer + 0.5.
 * Captures all pointer events for block placement / tool dispatch.
 * Moving it vertically with activeLayer ensures the perspective
 * intersection point maps correctly to the current editing layer.
 */
function InteractionPlane() {
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const { onPointerMove, onPointerDown, onPointerUp, onPointerLeave } = useBlockInteraction()

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, activeLayer + 0.5, 0]}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <planeGeometry args={[1000, 1000]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <Stage />
      <VoxelGrid />
      <GhostVoxelGrid />
      <HoverCube />
      <InteractionPlane />
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
      {/*
        Left click  = edit (handled by InteractionPlane)
        Right drag  = orbit
        Middle drag = pan
        Scroll      = zoom (always active regardless of mouseButtons)
      */}
      <OrbitControls
        makeDefault
        mouseButtons={{
          LEFT: null as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        target={[cx, cy, cz]}
      />
      <Scene />
    </Canvas>
  )
}
