import { useBlueprintStore } from '@/store/blueprintStore'

export default function MetadataPanel() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)

  if (!blueprint) return null

  const update = (patch: Partial<typeof blueprint.meta>) =>
    setBlueprint({ ...blueprint, meta: { ...blueprint.meta, ...patch } })

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-900 border-l border-zinc-700 w-52 shrink-0 overflow-y-auto text-xs">
      <p className="font-semibold text-zinc-200 border-b border-zinc-700 pb-1">Metadata</p>

      <Label>Name</Label>
      <input
        className="input"
        value={blueprint.meta.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="e.g. builder1"
      />

      <Label>File Name</Label>
      <input
        className="input"
        value={blueprint.meta.fileName}
        onChange={(e) => update({ fileName: e.target.value })}
        placeholder="e.g. builder1"
      />

      <Label>Pack Name</Label>
      <input
        className="input"
        value={blueprint.meta.packName}
        onChange={(e) => update({ packName: e.target.value })}
        placeholder="e.g. medievaloak"
      />

      <Label>Size</Label>
      <p className="text-zinc-400">
        {blueprint.sizeX} × {blueprint.sizeY} × {blueprint.sizeZ}
      </p>

      <Label>Anchor</Label>
      <p className="text-zinc-400 font-mono">
        ({blueprint.meta.primaryOffset.x}, {blueprint.meta.primaryOffset.y},{' '}
        {blueprint.meta.primaryOffset.z})
      </p>

      <Label>Required Mods</Label>
      {blueprint.requiredMods.length === 0 ? (
        <p className="text-zinc-500">None</p>
      ) : (
        <ul className="text-zinc-400">
          {blueprint.requiredMods.map((m) => (
            <li key={m} className="font-mono">{m}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-400 mt-1">{children}</p>
}
