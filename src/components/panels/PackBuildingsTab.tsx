import { BUILDINGS, BUILDING_CATEGORIES, type BuildingCategory, slugifyBuilding } from '@/lib/minecolonies/buildings'
import { useEditorStore } from '@/store/editorStore'
import { useBlueprintStore, makeEmptyBlueprint } from '@/store/blueprintStore'

const CAT_COLORS: Record<BuildingCategory, string> = {
  'CORE': '#d9943f',
  'PRODUCTION & CRAFTING': '#8f7bd9',
  'FOOD & HOSPITALITY': '#6fae6f',
  'ANIMALS': '#ae8f6f',
  'MILITARY & DEFENCE': '#d95555',
  'EDUCATION & RESEARCH': '#5c9cd9',
  'UTILITY & SPECIAL': '#8a8892',
}

export default function PackBuildingsTab() {
  const sessionBuildings = useEditorStore((s) => s.sessionBuildings)
  const addSessionBuilding = useEditorStore((s) => s.addSessionBuilding)
  const activeBuildingName = useEditorStore((s) => s.activeBuildingName)
  const switchToBuilding = useEditorStore((s) => s.switchToBuilding)
  const exportedBuildings = useEditorStore((s) => s.exportedBuildings)
  const currentLevel = useEditorStore((s) => s.currentLevel)
  const setCurrentLevel = useEditorStore((s) => s.setCurrentLevel)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const settings = useEditorStore((s) => s.settings)
  const saveCurrentLevel = useEditorStore((s) => s.saveCurrentLevel)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const showToast = useEditorStore((s) => s.showToast)
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)

  const openBuilding = (name: string) => {
    if (activeBuildingName === name) return // already active

    // Save current level before switching buildings
    if (blueprint) saveCurrentLevel(currentLevel, blueprint)

    // Switch building — flushes savedLevels to old building's snapshot and loads new one
    switchToBuilding(name)

    // Read restored levels synchronously
    const newLevels = useEditorStore.getState().savedLevels
    const restoredBp = newLevels[1]

    if (restoredBp) {
      setBlueprint(restoredBp)
      updateSettings({ gridX: restoredBp.sizeX, gridZ: restoredBp.sizeZ, maxY: restoredBp.sizeY })
      showToast(`Resumed ${name}`)
    } else {
      const { gridX, gridZ, maxY } = settings
      const bp = makeEmptyBlueprint(gridX, maxY, gridZ)
      bp.meta.name = name
      bp.meta.fileName = slugifyBuilding(name)
      bp.requiredMods = ['minecolonies', 'structurize']
      setBlueprint(bp)
      showToast(`Started ${name} — Level 1`)
    }

    setCurrentLevel(1)
    setActiveLayer(0)
    addSessionBuilding(name)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {BUILDING_CATEGORIES.map((cat) => {
        const items = BUILDINGS.filter((b) => b.category === cat)
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: '#6a6870', marginBottom: 8 }}>
              {cat}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {items.map((b) => {
                const started = sessionBuildings.includes(b.name)
                const isActive = activeBuildingName === b.name
                const exported = exportedBuildings[b.name] ?? []
                const exportedCount = exported.length
                const allDone = exportedCount === 5

                return (
                  <button
                    key={b.name}
                    onClick={() => openBuilding(b.name)}
                    title={b.desc}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      border: `1.5px solid ${isActive ? '#8a6fd6' : allDone ? '#4a7a4a' : started ? '#4a4a52' : '#2c2c30'}`,
                      borderRadius: 8, padding: 8,
                      background: isActive ? '#2a2330' : allDone ? '#1f2a1f' : '#1f1f23',
                      opacity: started && !isActive ? 0.85 : 1,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {allDone ? (
                      <div style={{
                        height: 40, borderRadius: 5, background: '#1a2e1a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        color: '#6fae6f', fontSize: 12, fontWeight: 700,
                      }}>
                        ✓ 5/5
                      </div>
                    ) : started ? (
                      <div style={{
                        height: 40, borderRadius: 5,
                        background: 'repeating-linear-gradient(45deg,#2c2c30 0 4px,#26262a 4px 8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        color: '#8a8892', fontSize: 9, fontFamily: 'ui-monospace,monospace',
                      }}>
                        {exportedCount > 0 ? `${exportedCount}/5 done` : 'Level 1–5'}
                      </div>
                    ) : (
                      <div style={{
                        height: 40, borderRadius: 5, background: '#232326',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: CAT_COLORS[cat], fontSize: 13, fontWeight: 800,
                      }}>
                        {b.mono}
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#e8e6e3', lineHeight: 1.25 }}>
                      {b.name}
                      {b.required && <span style={{ color: '#d9534f' }}> *</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <div style={{ fontSize: 10.5, color: '#5a5860', marginTop: 4, lineHeight: 1.5 }}>
        <span style={{ color: '#d9534f' }}>*</span> Required for a functional colony
      </div>
    </div>
  )
}
