import { useBlueprintStore } from '@/store/blueprintStore'
import { MC_TAG_CATALOGUE } from '@/lib/blueprint/types'
import { useEditorStore } from '@/store/editorStore'

export default function TagPanel() {
  const tagTargetPos = useEditorStore((s) => s.tagTargetPos)
  const setTagTargetPos = useEditorStore((s) => s.setTagTargetPos)
  const blueprint = useBlueprintStore((s) => s.blueprint)

  if (!tagTargetPos || !blueprint) return null

  const { x, y, z } = tagTargetPos
  const blockIdx = blueprint.structure[y]?.[z]?.[x] ?? 0
  const blockName = blueprint.palette[blockIdx]?.name ?? 'minecraft:air'

  return (
    <div className="absolute bottom-4 right-4 w-72 bg-zinc-900 border border-zinc-600 rounded-lg shadow-xl p-3 z-10">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs font-semibold text-zinc-100">Tag Block</p>
          <p className="text-[10px] text-zinc-500">{blockName} at ({x},{y},{z})</p>
        </div>
        <button
          onClick={() => setTagTargetPos(null)}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          ✕
        </button>
      </div>

      <p className="text-[10px] text-zinc-400 mb-2">
        Click a tag to add it to this block's tile entity data.
      </p>

      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {MC_TAG_CATALOGUE.map((meta) => (
          <button
            key={meta.tag}
            title={meta.description}
            className="text-left px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
          >
            <span className="font-mono text-indigo-400">{meta.tag}</span>
            <span className="text-zinc-500 ml-2">{meta.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
