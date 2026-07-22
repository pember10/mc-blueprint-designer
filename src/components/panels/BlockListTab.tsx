import { useMemo } from 'react'
import { useBlueprintStore } from '@/store/blueprintStore'
import { useEditorStore } from '@/store/editorStore'
import { getBlock } from '@/lib/blocks/registry'
import { resolveColorSync } from '@/lib/blocks/textures'

interface BlockGroup {
  ns: string
  color: string
  items: Array<{ name: string; displayName: string; color: string; count: number }>
}

const NS_COLORS: Record<string, string> = {
  minecraft: '#6a9fc8',
  minecolonies: '#d9943f',
  structurize: '#8f7bd9',
  domum_ornamentum: '#b3675a',
}

export default function BlockListTab() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setHighlightBlock = useEditorStore((s) => s.setHighlightBlock)
  const highlightBlock = useEditorStore((s) => s.highlightBlock)
  const currentLevel = useEditorStore((s) => s.currentLevel)

  const groups = useMemo<BlockGroup[]>(() => {
    if (!blueprint) return []
    const counts = new Map<string, number>()
    const { structure, sizeX, sizeY, sizeZ, palette } = blueprint
    for (let y = 0; y < sizeY; y++)
      for (let z = 0; z < sizeZ; z++)
        for (let x = 0; x < sizeX; x++) {
          const idx = structure[y]?.[z]?.[x] ?? 0
          if (idx === 0) continue
          const name = palette[idx]?.name
          if (name && name !== 'minecraft:air') counts.set(name, (counts.get(name) ?? 0) + 1)
        }

    const byNs = new Map<string, BlockGroup>()
    for (const [name, count] of counts) {
      const ns = name.split(':')[0]
      const entry = getBlock(name)
      const color = resolveColorSync(name)
      if (!byNs.has(ns)) {
        byNs.set(ns, { ns, color: NS_COLORS[ns] ?? '#8a8892', items: [] })
      }
      byNs.get(ns)!.items.push({
        name,
        displayName: entry?.displayName ?? name.split(':')[1] ?? name,
        color,
        count,
      })
    }
    for (const grp of byNs.values()) {
      grp.items.sort((a, b) => b.count - a.count)
    }
    return [...byNs.values()]
  }, [blueprint])

  const totalBlocks = useMemo(
    () => groups.reduce((s, g) => s + g.items.reduce((a, b) => a + b.count, 0), 0),
    [groups],
  )

  if (!blueprint) return null

  const handleJump = (name: string) => {
    if (highlightBlock === name) {
      setHighlightBlock(null)
    } else {
      setHighlightBlock(name)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#6a6870', marginBottom: 12 }}>
        LEVEL {currentLevel} — {totalBlocks.toLocaleString()} BLOCKS
      </div>

      {groups.length === 0 && (
        <div style={{ fontSize: 12.5, color: '#6a6870', padding: '20px 0', textAlign: 'center' }}>
          No blocks placed yet.
        </div>
      )}

      {groups.map((grp) => (
        <div key={grp.ns} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: grp.color, marginBottom: 8 }}>
            {grp.ns.toUpperCase()}
          </div>
          {grp.items.map((it) => (
            <div
              key={it.name}
              onClick={() => handleJump(it.name)}
              title={it.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 8px', margin: '0 -8px',
                borderRadius: 6, borderBottom: '1px solid #232326',
                cursor: 'pointer',
                background: highlightBlock === it.name ? 'rgba(138,111,214,0.15)' : 'transparent',
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: it.color }} />
              <div style={{ flex: 1, fontSize: 12.5, color: '#e8e6e3' }}>{it.displayName}</div>
              <div style={{ fontSize: 11.5, color: '#8a8892', fontFamily: 'ui-monospace,monospace' }}>
                ×{it.count}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Required mods */}
      <div style={{ height: 1, background: '#2c2c30', margin: '6px 0 14px' }} />
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: '#6a6870', marginBottom: 8 }}>
        REQUIRED MODS
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {blueprint.requiredMods.length === 0 ? (
          <div style={{ fontSize: 11.5, color: '#5a5860' }}>None declared</div>
        ) : (
          blueprint.requiredMods.map((m) => (
            <div key={m} style={{
              background: '#232326', border: '1px solid #33333a', borderRadius: 6,
              padding: '5px 10px', fontSize: 11.5, color: '#c8c6cf',
            }}>
              {m}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
