import { useStore } from 'zustand'
import { useBlueprintStore, makeEmptyBlueprint } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { openBlueprintFile, downloadBlueprint, downloadPackZip } from '@/lib/io/localIO'
import { BUILDINGS } from '@/lib/minecolonies/buildings'


const LEVELS = [1, 2, 3, 4, 5]

export default function Toolbar() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)
  const currentLevel = useEditorStore((s) => s.currentLevel)
  const setCurrentLevel = useEditorStore((s) => s.setCurrentLevel)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const settings = useEditorStore((s) => s.settings)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const showToast = useEditorStore((s) => s.showToast)
  const setShowSettings = useEditorStore((s) => s.setShowSettings)
  const setShowResourcePack = useEditorStore((s) => s.setShowResourcePack)
  const savedLevels = useEditorStore((s) => s.savedLevels)
  const saveCurrentLevel = useEditorStore((s) => s.saveCurrentLevel)
  const markLevelExported = useEditorStore((s) => s.markLevelExported)
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
      // Save current level before replacing with the opened file
      if (blueprint) saveCurrentLevel(currentLevel, blueprint)
      setBlueprint(bp)
      saveCurrentLevel(currentLevel, bp)
      updateSettings({ gridX: bp.sizeX, gridZ: bp.sizeZ, maxY: bp.sizeY })
      setActiveLayer(0)
      showToast(`Opened ${bp.meta.fileName || 'blueprint'}`)
    } catch {
      // user cancelled or error
    }
  }

  const handleExport = () => {
    if (!blueprint) return
    const exported = { ...blueprint }
    downloadBlueprint(exported)
    const building = BUILDINGS.find((b) => b.name === blueprint.meta.name)
    if (building) markLevelExported(building.name, currentLevel)
    showToast(`Exported ${exported.meta.fileName || 'blueprint'}.blueprint`)
  }

  const handleExportPack = async () => {
    const snap: Record<number, import('@/lib/blueprint/types').Blueprint> = { ...savedLevels }
    if (blueprint) snap[currentLevel] = blueprint
    const levelCount = Object.keys(snap).length
    if (levelCount === 0) { showToast('No blueprints to export'); return }
    const packName = blueprint?.meta.packName || blueprint?.meta.fileName || 'pack'
    const count = await downloadPackZip(snap, packName)
    // Mark all exported levels as done
    const building = blueprint ? BUILDINGS.find((b) => b.name === blueprint.meta.name) : null
    if (building) {
      for (const lvl of Object.keys(snap)) markLevelExported(building.name, Number(lvl))
    }
    showToast(`Exported pack: ${count} level${count !== 1 ? 's' : ''} in ${packName}.zip`)
  }

  const handleLevelClick = (lvl: number) => {
    if (lvl === currentLevel) return
    // Persist the current blueprint before leaving
    if (blueprint) saveCurrentLevel(currentLevel, blueprint)
    // Restore previously saved blueprint for target level, or create blank
    const saved = savedLevels[lvl]
    if (saved) {
      setBlueprint(saved)
      updateSettings({ gridX: saved.sizeX, gridZ: saved.sizeZ, maxY: saved.sizeY })
    } else {
      const { gridX, gridZ, maxY } = settings
      const bp = makeEmptyBlueprint(gridX, maxY, gridZ)
      if (blueprint) {
        bp.meta.name = blueprint.meta.name
        bp.meta.fileName = blueprint.meta.fileName
        bp.meta.packName = blueprint.meta.packName
        bp.requiredMods = [...blueprint.requiredMods]
      }
      setBlueprint(bp)
    }
    setCurrentLevel(lvl)
    setActiveLayer(0)
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
          const hasBlocks = (savedLevels[lvl]?.palette.length ?? 0) > 1
          const hasSave = hasBlocks || active
          return (
            <button
              key={lvl}
              onClick={() => handleLevelClick(lvl)}
              title={`Level ${lvl}${hasBlocks ? ' (has blocks)' : ' (empty)'}`}
              style={{
                border: 'none', borderRadius: '50%', width: 38, height: 38, flexShrink: 0,
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', position: 'relative',
                background: active ? '#8a6fd6' : 'transparent',
                color: active ? '#fff' : hasSave ? '#c8c6cf' : '#6a6870',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {`L${lvl}`}
              {hasBlocks && !active && (
                <span style={{
                  position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: '#8a6fd6',
                }} />
              )}
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
          Export Level
        </button>
        <button
          onClick={handleExportPack}
          disabled={!blueprint}
          style={{
            background: 'transparent', color: '#8a6fd6', border: '1px solid #8a6fd6',
            borderRadius: 7, padding: '9px 16px', fontSize: 12.5, fontWeight: 600,
            cursor: blueprint ? 'pointer' : 'default', opacity: blueprint ? 1 : 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          Export Pack
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
