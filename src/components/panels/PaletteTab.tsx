import { useState, useMemo } from 'react'
import { getAllBlocks } from '@/lib/blocks/registry'
import { resolveColorSync } from '@/lib/blocks/textures'
import { useEditorStore } from '@/store/editorStore'
import { useBlueprintStore } from '@/store/blueprintStore'
import { MC_TAG_CATALOGUE } from '@/lib/blueprint/types'

const ALL_BLOCKS = getAllBlocks().filter((b) => b.id !== 'minecraft:air')

const MOD_CHIPS = [
  { id: 'all',              label: 'All' },
  { id: 'minecraft',        label: 'Vanilla' },
  { id: 'minecolonies',     label: 'MineColonies' },
  { id: 'structurize',      label: 'Structurize' },
  { id: 'domum_ornamentum', label: 'Domum' },
]

// Tag display colors — keyed by McTag string
const TAG_CHIP_COLORS: Record<string, string> = {
  groundlevel: '#5c9cd9', work: '#d9943f', crafting: '#8f7bd9',
  sleeping: '#5c9cd9', storage: '#a9743a', guard: '#a13d3d', ladder: '#6fae6f',
}
function tagChipColor(tag: string) { return TAG_CHIP_COLORS[tag] ?? '#4a6a8a' }

export default function PaletteTab() {
  const [search, setSearch] = useState('')
  const [modFilter, setModFilter] = useState('all')

  const selectedBlockName = useEditorStore((s) => s.selectedBlockName)
  const setSelectedBlock = useEditorStore((s) => s.setSelectedBlock)
  const setTool = useEditorStore((s) => s.setTool)
  const tool = useEditorStore((s) => s.tool)
  const inspectedCell = useEditorStore((s) => s.inspectedCell)
  const tagTargetCell = useEditorStore((s) => s.tagTargetCell)
  const setTagTargetCell = useEditorStore((s) => s.setTagTargetCell)
  const tags = useEditorStore((s) => s.tags)
  const setTag = useEditorStore((s) => s.setTag)
  const clearTag = useEditorStore((s) => s.clearTag)
  const textureMap = useEditorStore((s) => s.textureMap)
  const blueprint = useBlueprintStore((s) => s.blueprint)

  const filtered = useMemo(() => {
    let blocks = ALL_BLOCKS
    if (modFilter !== 'all') {
      blocks = blocks.filter((b) =>
        modFilter === 'minecolonies'
          ? b.namespace === 'minecolonies' || b.namespace === 'domum_ornamentum'
          : b.namespace === modFilter,
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      blocks = blocks.filter(
        (b) => b.id.toLowerCase().includes(q) || b.displayName.toLowerCase().includes(q),
      )
    }
    return blocks
  }, [modFilter, search])

  // ── Inspector (Select tool) ───────────────────────────────────────────────

  const inspectedBlock = useMemo(() => {
    if (!inspectedCell || !blueprint) return null
    const { x, y, z } = inspectedCell
    const pidx = blueprint.structure[y]?.[z]?.[x] ?? 0
    if (pidx === 0) return null
    const name = blueprint.palette[pidx]?.name ?? ''
    const ns = name.split(':')[0] ?? ''
    return { name, x, y, z, mod: ns }
  }, [inspectedCell, blueprint])

  // ── Tag inspector (Tag tool) ──────────────────────────────────────────────

  const tagTargetBlock = useMemo(() => {
    if (!tagTargetCell || !blueprint) return null
    const { x, y, z } = tagTargetCell
    const pidx = blueprint.structure[y]?.[z]?.[x] ?? 0
    if (pidx === 0) return null
    return { name: blueprint.palette[pidx]?.name ?? '', x, y, z }
  }, [tagTargetCell, blueprint])

  const tagKey = tagTargetCell ? `${tagTargetCell.x}_${tagTargetCell.y}_${tagTargetCell.z}` : null
  const currentTag = tagKey ? tags[tagKey] ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Inspector card (select tool) */}
      {tool === 'select' && (
        <div style={{ background: '#232326', border: '1px solid #33333a', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#8f7bd9', marginBottom: 8 }}>INSPECTOR</div>
          {inspectedBlock ? (
            <>
              <div style={{ fontSize: 12.5, color: '#e8e6e3', marginBottom: 2 }}>{inspectedBlock.name.split(':')[1]}</div>
              <div style={{ fontSize: 11, color: '#8a8892', fontFamily: 'ui-monospace,monospace', marginBottom: 6 }}>{inspectedBlock.name}</div>
              <div style={{ fontSize: 11, color: '#8a8892' }}>
                ({inspectedBlock.x}, {inspectedBlock.y}, {inspectedBlock.z}) · {inspectedBlock.mod}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#6a6870' }}>Click a block in the layer grid to inspect it.</div>
          )}
        </div>
      )}

      {/* Tag inspector (tag tool) */}
      {tool === 'tag' && (
        <div style={{ background: '#232326', border: '1px solid #33333a', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#8f7bd9', marginBottom: 8 }}>TAG INSPECTOR</div>
          {tagTargetBlock && tagKey ? (
            <>
              <div style={{ fontSize: 12.5, color: '#e8e6e3', marginBottom: 10 }}>
                {tagTargetBlock.name.split(':')[1]}{' '}
                <span style={{ color: '#6a6870' }}>({tagTargetBlock.x}, {tagTargetBlock.y}, {tagTargetBlock.z})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MC_TAG_CATALOGUE.map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setTag(tagKey, t.tag)}
                    style={{
                      border: 'none', borderRadius: 6, padding: '6px 10px',
                      fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      background: currentTag === t.tag ? tagChipColor(t.tag) : '#2c2c30',
                      color: currentTag === t.tag ? '#161616' : '#c8c6cf',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  onClick={() => { if (tagKey) clearTag(tagKey); setTagTargetCell(null) }}
                  style={{ border: '1px solid #3a3a40', borderRadius: 6, padding: '6px 10px', fontSize: 11.5, cursor: 'pointer', background: 'transparent', color: '#8a8892' }}
                >
                  Clear
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#6a6870' }}>Click a non-air block in the layer grid to assign a function tag.</div>
          )}
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search blocks…"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#232326', border: '1px solid #33333a', borderRadius: 7,
          padding: '9px 12px', color: '#e8e6e3', fontSize: 12.5, marginBottom: 10,
          outline: 'none',
        }}
      />

      {/* Mod filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {MOD_CHIPS.map((m) => (
          <button
            key={m.id}
            onClick={() => setModFilter(m.id)}
            style={{
              border: 'none', borderRadius: 6, padding: '6px 10px',
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              background: modFilter === m.id ? '#8a6fd6' : '#2c2c30',
              color: modFilter === m.id ? '#fff' : '#c8c6cf',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Block grid (4 columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {filtered.map((b) => {
          const color = resolveColorSync(b.id)
          const tex = textureMap[b.id]
          const isSelected = b.id === selectedBlockName
          return (
            <button
              key={b.id}
              title={b.id}
              onClick={() => { setSelectedBlock(b.id); setTool('place') }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                border: `2px solid ${isSelected ? '#8a6fd6' : '#2c2c30'}`,
                borderRadius: 8, padding: '8px 4px',
                background: isSelected ? '#2a2330' : '#1f1f23',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 5,
                background: color,
                backgroundImage: tex ? `url(${tex})` : undefined,
                backgroundSize: 'cover',
                imageRendering: 'pixelated',
              }} />
              <div style={{ fontSize: 9.5, color: '#c8c6cf', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>
                {b.displayName}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6a6870', fontSize: 12, padding: '20px 0' }}>
            No blocks found
          </div>
        )}
      </div>
    </div>
  )
}
