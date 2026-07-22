import { useStore } from 'zustand'
import { useBlueprintStore, makeEmptyBlueprint } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { openBlueprintFile, downloadBlueprint } from '@/lib/io/localIO'


const LEVELS = [1, 2, 3, 4, 5]

export default function Toolbar() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)
  const setGhost = useBlueprintStore((s) => s.setGhost)
  const currentLevel = useEditorStore((s) => s.currentLevel)
  const setCurrentLevel = useEditorStore((s) => s.setCurrentLevel)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const settings = useEditorStore((s) => s.settings)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const showToast = useEditorStore((s) => s.showToast)
  const setShowSettings = useEditorStore((s) => s.setShowSettings)
  const setShowResourcePack = useEditorStore((s) => s.setShowResourcePack)
  // Undo / redo from zundo temporal store
  const undo = () => useBlueprintStore.temporal.getState().undo()
  const redo = () => useBlueprintStore.temporal.getState().redo()
  const canUndo = useStore(useBlueprintStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useBlueprintStore.temporal, (s) => s.futureStates.length > 0)

  const fileName = blueprint?.meta.fileName ?? 'untitled'

  const handleNew = () => {
    const { gridX, gridZ, maxY } = settings
    const bp = makeEmptyBlueprint(gridX, maxY, gridZ)
    setBlueprint(bp)
    setCurrentLevel(1)
    setActiveLayer(0)
  }

  const handleOpen = async () => {
    try {
      const bp = await openBlueprintFile()
      setBlueprint(bp)
      updateSettings({ gridX: bp.sizeX, gridZ: bp.sizeZ, maxY: bp.sizeY })
      setActiveLayer(0)
      showToast(`Opened ${bp.meta.fileName || 'blueprint'}`)
    } catch {
      // user cancelled or error
    }
  }

  const handleLoadGhost = async () => {
    try {
      const bp = await openBlueprintFile()
      const match = bp.meta.fileName?.match(/(\d+)/)
      const level = match ? parseInt(match[1]) : null
      setGhost(bp, level)
      showToast(`Ghost loaded: Level ${level ?? '?'}`)
    } catch {
      // user cancelled
    }
  }

  const handleExport = () => {
    if (!blueprint) return
    // Update fileName from metadata before exporting
    const exported = { ...blueprint }
    downloadBlueprint(exported)
    showToast(`Exported ${exported.meta.fileName || 'blueprint'}.blueprint`)
  }

  const handleLevelClick = (lvl: number) => {
    if (lvl === currentLevel) return
    const { gridX, gridZ, maxY } = settings
    const bp = makeEmptyBlueprint(gridX, maxY, gridZ)
    // Preserve building identity from current blueprint
    if (blueprint) {
      bp.meta.name = blueprint.meta.name
      bp.meta.fileName = blueprint.meta.fileName
      bp.meta.packName = blueprint.meta.packName
      bp.requiredMods = [...blueprint.requiredMods]
    }
    setBlueprint(bp)
    setCurrentLevel(lvl)
    setActiveLayer(0)
    showToast(`Level ${lvl} — blank canvas (use Open\u2026 to load existing)`)
  }

  return (
    <div style={{
      minHeight: 64, flexShrink: 0,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 18px',
      padding: '10px 22px',
      background: '#1c1c1f', borderBottom: '1px solid #2c2c30',
    }}>
      {/* Logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15, color: '#fff' }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#8a6fd6,#6a52b0)' }} />
        Blueprint Editor
      </div>

      {/* File name */}
      <div style={{ color: '#7a7880', fontSize: 12.5, paddingLeft: 8, borderLeft: '1px solid #33333a' }}>
        {fileName ? `${fileName}${currentLevel}.blueprint` : 'new.blueprint'}
      </div>

      {/* Undo / Redo */}
      <div style={{ display: 'flex', gap: 8 }}>
        <TBtn onClick={undo} disabled={!canUndo}>Undo</TBtn>
        <TBtn onClick={redo} disabled={!canRedo}>Redo</TBtn>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Level tabs */}
      <div style={{ display: 'flex', gap: 5, background: '#232326', padding: 4, borderRadius: 10 }}>
        {LEVELS.map((lvl) => {
          const active = lvl === currentLevel
          return (
            <button
              key={lvl}
              onClick={() => handleLevelClick(lvl)}
              title={lvl === currentLevel ? `Level ${lvl} (current)` : `Load Level ${lvl}`}
              style={{
                border: 'none', borderRadius: '50%', width: 38, height: 38, flexShrink: 0,
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: active ? '#8a6fd6' : 'transparent',
                color: active ? '#fff' : '#6a6870',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {lvl}
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* File / settings buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TBtn onClick={handleNew}>New</TBtn>
        <TBtn onClick={handleOpen}>Open…</TBtn>
        <TBtn onClick={handleLoadGhost}>Ghost…</TBtn>
        <TBtn onClick={() => setShowResourcePack(true)}>Import Resource Pack</TBtn>
        <button
          onClick={handleExport}
          disabled={!blueprint}
          style={{
            background: '#8a6fd6', color: '#fff', border: 'none',
            borderRadius: 7, padding: '9px 16px', fontSize: 12.5, fontWeight: 600,
            cursor: blueprint ? 'pointer' : 'default', opacity: blueprint ? 1 : 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          Export .blueprint
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          style={{
            width: 36, height: 36, flexShrink: 0,
            border: '1px solid #33333a', borderRadius: 8,
            background: '#232326', color: '#c8c6cf',
            fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ⚙
        </button>
      </div>
    </div>
  )
}

// Small toolbar button
function TBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: '#232326', color: disabled ? '#5a5860' : '#c8c6cf',
        border: '1px solid #33333a', borderRadius: 7,
        padding: '9px 14px', fontSize: 12.5, cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
