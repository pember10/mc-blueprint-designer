import { useEditorStore, type RailTab } from '@/store/editorStore'
import PaletteTab from './PaletteTab'
import MetadataTab from './MetadataTab'
import BlockListTab from './BlockListTab'
import PackBuildingsTab from './PackBuildingsTab'
import ValidationTab from './ValidationTab'

const TABS: Array<{ id: RailTab; label: string }> = [
  { id: 'palette',       label: 'Palette' },
  { id: 'metadata',      label: 'Metadata' },
  { id: 'blockList',     label: 'Block List' },
  { id: 'packBuildings', label: 'Pack Buildings' },
  { id: 'validation',    label: 'Validation' },
]

export default function RightRail() {
  const railTab = useEditorStore((s) => s.railTab)
  const setRailTab = useEditorStore((s) => s.setRailTab)

  return (
    <div style={{
      width: 344,
      flexShrink: 0,
      background: '#19191c',
      borderLeft: '1px solid #2c2c30',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2c2c30', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = railTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setRailTab(t.id)}
              style={{
                flexShrink: 0,
                minWidth: 78,
                border: 'none',
                background: active ? '#1f1f23' : 'transparent',
                color: active ? '#e8e6e3' : '#8a8892',
                padding: '13px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                borderBottom: `2px solid ${active ? '#8a6fd6' : 'transparent'}`,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {railTab === 'palette'       && <PaletteTab />}
        {railTab === 'metadata'      && <MetadataTab />}
        {railTab === 'blockList'     && <BlockListTab />}
        {railTab === 'packBuildings' && <PackBuildingsTab />}
        {railTab === 'validation'    && <ValidationTab />}
      </div>
    </div>
  )
}
