import { useMemo, useState } from 'react'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { BUILDINGS, slugifyBuilding } from '@/lib/minecolonies/buildings'

export default function MetadataTab() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)
  const currentLevel = useEditorStore((s) => s.currentLevel)
  if (!blueprint) return <div style={{ color: '#6a6870', fontSize: 12 }}>No blueprint loaded.</div>

  const update = (patch: Partial<typeof blueprint.meta>) =>
    setBlueprint({ ...blueprint, meta: { ...blueprint.meta, ...patch } })

  const updateOffset = (axis: 'x' | 'y' | 'z', val: string) =>
    update({ primaryOffset: { ...blueprint.meta.primaryOffset, [axis]: parseInt(val) || 0 } })

  const updateRequiredMods = (mods: string[]) =>
    setBlueprint({ ...blueprint, requiredMods: mods })

  // Auto-compute filename from hutType + level
  const computedFileName = useMemo(() => {
    const building = BUILDINGS.find((b) => b.name === blueprint.meta.name)
    if (building) return `${slugifyBuilding(building.name)}${currentLevel}.blueprint`
    return blueprint.meta.fileName ? `${blueprint.meta.fileName}` : ''
  }, [blueprint.meta.name, blueprint.meta.fileName, currentLevel])

  const hutTypeOptions = [
    { id: '', label: '— Custom —' },
    ...BUILDINGS.map((b) => ({ id: b.name, label: b.name + (b.required ? ' *' : '') })),
  ]

  const [newModInput, setNewModInput] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Name (hut type selector) */}
      <Field label="Hut type">
        <select
          value={blueprint.meta.name}
          onChange={(e) => update({ name: e.target.value, fileName: slugifyBuilding(e.target.value) })}
          style={inputStyle}
        >
          {hutTypeOptions.map((h) => (
            <option key={h.id} value={h.id}>{h.label}</option>
          ))}
        </select>
      </Field>

      {/* File name (computed, read-only) */}
      <Field label="File name">
        <div style={{ ...inputStyle, background: '#1a1a1d', color: '#8a8892', fontFamily: 'ui-monospace,monospace' }}>
          {computedFileName || '—'}
        </div>
      </Field>

      {/* Pack name */}
      <Field label="Pack name">
        <input
          value={blueprint.meta.packName}
          onChange={(e) => update({ packName: e.target.value })}
          placeholder="e.g. medievaloak"
          style={inputStyle}
        />
      </Field>

      {/* MC version */}
      <Field label="MC version (data version int)">
        <input
          value={blueprint.mcVersion}
          onChange={(e) => setBlueprint({ ...blueprint, mcVersion: parseInt(e.target.value) || blueprint.mcVersion })}
          style={inputStyle}
        />
      </Field>

      {/* Size (read-only) */}
      <Field label="Size">
        <div style={{ ...inputStyle, background: '#1a1a1d', color: '#8a8892' }}>
          {blueprint.sizeX} × {blueprint.sizeY} × {blueprint.sizeZ}
        </div>
      </Field>

      {/* Primary offset */}
      <Field label="Primary offset (anchor)">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['x', 'y', 'z'] as const).map((ax) => (
            <input
              key={ax}
              type="number"
              value={blueprint.meta.primaryOffset[ax]}
              onChange={(e) => updateOffset(ax, e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            />
          ))}
        </div>
      </Field>

      {/* Required mods */}
      <Field label="Required mods">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {blueprint.requiredMods.map((m) => (
            <div key={m} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#232326', border: '1px solid #33333a', borderRadius: 6,
              padding: '5px 6px 5px 10px', fontSize: 11.5, color: '#c8c6cf',
            }}>
              {m}
              <span
                onClick={() => updateRequiredMods(blueprint.requiredMods.filter((x) => x !== m))}
                style={{ cursor: 'pointer', color: '#8a8892', padding: '0 3px' }}
              >×</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={newModInput}
            onChange={(e) => setNewModInput(e.target.value)}
            placeholder="mod_id"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newModInput.trim()) {
                if (!blueprint.requiredMods.includes(newModInput.trim())) {
                  updateRequiredMods([...blueprint.requiredMods, newModInput.trim()])
                }
                setNewModInput('')
              }
            }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => {
              if (newModInput.trim() && !blueprint.requiredMods.includes(newModInput.trim())) {
                updateRequiredMods([...blueprint.requiredMods, newModInput.trim()])
                setNewModInput('')
              }
            }}
            style={{
              border: 'none', borderRadius: 7, padding: '0 14px',
              background: '#8a6fd6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#232326',
  border: '1px solid #33333a',
  borderRadius: 7,
  padding: '8px 10px',
  color: '#e8e6e3',
  fontSize: 12.5,
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8a8892', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

// (helpers below)
