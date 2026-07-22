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
  const setCurrentLevel = useEditorStore((s) => s.setCurrentLevel)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const settings = useEditorStore((s) => s.settings)
  const showToast = useEditorStore((s) => s.showToast)
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)

  const openBuilding = (name: string) => {
    const alreadyExists = sessionBuildings.includes(name)
    if (alreadyExists) {
      // Already worked on this session — just switch to it (would need a file re-open
      // in a full implementation; for now just notify)
      showToast(`${name} was already opened this session. Use File → Open to reload.`)
      return
    }
    // Create fresh blueprint for this building
    const { gridX, gridZ, maxY } = settings
    const bp = makeEmptyBlueprint(gridX, maxY, gridZ)
    bp.meta.name = name
    bp.meta.fileName = slugifyBuilding(name)
    bp.requiredMods = ['minecolonies', 'structurize']
    setBlueprint(bp)
    setCurrentLevel(1)
    setActiveLayer(0)
    addSessionBuilding(name)
    showToast(`Started ${name} — Level 1`)
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
                const exists = sessionBuildings.includes(b.name)
                const isActive = blueprint?.meta.name === b.name
                return (
                  <button
                    key={b.name}
                    onClick={() => openBuilding(b.name)}
                    title={b.desc}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      border: `1.5px solid ${isActive ? '#8a6fd6' : exists ? '#4a4a52' : '#2c2c30'}`,
                      borderRadius: 8, padding: 8,
                      background: isActive ? '#2a2330' : '#1f1f23',
                      opacity: exists && !isActive ? 0.85 : 1,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {exists ? (
                      <div style={{
                        height: 40, borderRadius: 5,
                        background: 'repeating-linear-gradient(45deg,#2c2c30 0 4px,#26262a 4px 8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#6a6870', fontSize: 8, fontFamily: 'ui-monospace,monospace',
                      }}>
                        Level 1–5
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
