import { useEffect } from 'react'
import Toolbar from '@/components/layout/Toolbar'
import BlockPalette from '@/components/panels/BlockPalette'
import Viewport from '@/components/editor/Viewport'
import MetadataPanel from '@/components/panels/MetadataPanel'
import TagPanel from '@/components/panels/TagPanel'
import { useEditorStore } from '@/store/editorStore'
import { useBlueprintStore, makeBlueprint } from '@/store/blueprintStore'

export default function App() {
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)
  const setTool = useEditorStore((s) => s.setTool)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const toggleSymmetryX = useEditorStore((s) => s.toggleSymmetryX)
  const toggleSymmetryZ = useEditorStore((s) => s.toggleSymmetryZ)
  const setShowGhost = useEditorStore((s) => s.setShowGhost)
  const showGhost = useEditorStore((s) => s.showGhost)

  // Create a default empty blueprint on first load
  useEffect(() => {
    const bp = makeBlueprint()
    bp.sizeX = 16
    bp.sizeY = 10
    bp.sizeZ = 16
    bp.structure = Array.from({ length: 10 }, () =>
      Array.from({ length: 16 }, () => new Array(16).fill(0)),
    )
    setBlueprint(bp)
    setActiveLayer(0)
  }, [setBlueprint, setActiveLayer])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const maxLayer = blueprint ? blueprint.sizeY - 1 : 0
      switch (e.key) {
        case 's': setTool('select'); break
        case 'p': setTool('place'); break
        case 'e': setTool('erase'); break
        case 'b': setTool('paint'); break
        case 'i': setTool('pick'); break
        case 't': setTool('tag'); break
        case 'x': toggleSymmetryX(); break
        case 'z': if (!e.ctrlKey && !e.metaKey) toggleSymmetryZ(); break
        case 'g': setShowGhost(!showGhost); break
        case '[': setActiveLayer(Math.max(0, activeLayer - 1)); break
        case ']': setActiveLayer(Math.min(maxLayer, activeLayer + 1)); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setTool, toggleSymmetryX, toggleSymmetryZ, setShowGhost, showGhost, activeLayer, setActiveLayer, blueprint])

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main content: palette | viewport | metadata */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: block palette */}
        <BlockPalette />

        {/* Center: 3D viewport */}
        <div className="relative flex-1 overflow-hidden">
          <Viewport />
          {/* Tag panel floats over viewport */}
          <TagPanel />
        </div>

        {/* Right: metadata */}
        <MetadataPanel />
      </div>
    </div>
  )
}
