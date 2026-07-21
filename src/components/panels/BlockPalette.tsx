import { useState, useMemo } from 'react'
import { getAllBlocks, type BlockEntry } from '@/lib/blocks/registry'
import { resolveColorSync } from '@/lib/blocks/textures'
import { useEditorStore } from '@/store/editorStore'

const TABS = ['All', 'Vanilla', 'Structurize', 'MineColonies', 'Favorites'] as const
type Tab = (typeof TABS)[number]

const ALL_BLOCKS = getAllBlocks()

export default function BlockPalette() {
  const [tab, setTab] = useState<Tab>('All')
  const [search, setSearch] = useState('')

  const selectedBlockName = useEditorStore((s) => s.selectedBlockName)
  const setSelectedBlock = useEditorStore((s) => s.setSelectedBlock)
  const setTool = useEditorStore((s) => s.setTool)
  const setDragging = useEditorStore((s) => s.setDragging)

  const filtered = useMemo(() => {
    let blocks = ALL_BLOCKS.filter((b) => b.id !== 'minecraft:air')
    if (tab === 'Vanilla') blocks = blocks.filter((b) => b.namespace === 'minecraft')
    else if (tab === 'Structurize') blocks = blocks.filter((b) => b.namespace === 'structurize')
    else if (tab === 'MineColonies') blocks = blocks.filter((b) => b.namespace === 'minecolonies' || b.namespace === 'domum_ornamentum')
    else if (tab === 'Favorites') blocks = [] // TODO: persist favorites

    if (search.trim()) {
      const q = search.toLowerCase()
      blocks = blocks.filter(
        (b) => b.id.toLowerCase().includes(q) || b.displayName.toLowerCase().includes(q),
      )
    }
    return blocks
  }, [tab, search])

  const handleSelect = (block: BlockEntry) => {
    setSelectedBlock(block.id)
    setTool('place')
  }

  const handlePointerDown = (block: BlockEntry) => {
    setDragging({
      blockName: block.id,
      paletteIndex: -1,
      textureDataUrl: '',
    })
    setSelectedBlock(block.id)
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-700 w-56 shrink-0">
      {/* Tabs */}
      <div className="flex gap-1 px-2 pt-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-2 py-1 rounded ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        <input
          type="text"
          placeholder="Search blocks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded bg-zinc-800 border border-zinc-600 text-zinc-100 text-xs px-2 py-1 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="grid grid-cols-3 gap-1">
          {filtered.map((block) => {
            const color = resolveColorSync(block.id)
            const isSelected = block.id === selectedBlockName
            return (
              <button
                key={block.id}
                title={`${block.displayName}\n${block.id}`}
                onClick={() => handleSelect(block)}
                onPointerDown={() => handlePointerDown(block)}
                className={`relative flex flex-col items-center rounded p-1 cursor-pointer transition-colors ${
                  isSelected
                    ? 'ring-2 ring-indigo-400 bg-zinc-700'
                    : 'bg-zinc-800 hover:bg-zinc-700'
                }`}
              >
                {/* Color swatch */}
                <div
                  className="w-10 h-10 rounded"
                  style={{ backgroundColor: color }}
                />
                {/* Label */}
                <span className="text-[9px] text-zinc-400 mt-0.5 w-full text-center truncate leading-tight">
                  {block.displayName}
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="col-span-3 text-center text-zinc-500 text-xs py-4">No blocks found</p>
          )}
        </div>
      </div>
    </div>
  )
}
