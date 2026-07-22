import { useState } from 'react'
import { useBlueprintStore } from '@/store/blueprintStore'
import { getUnknownNamespaces } from '@/lib/blueprint/validate'

/**
 * Shown below the toolbar whenever the active blueprint's palette contains
 * blocks from namespaces not shipped with vanilla / Structurize / MineColonies.
 * Dismissible per session.
 */
export default function MissingModsBanner() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const [dismissed, setDismissed] = useState(false)

  if (!blueprint || dismissed) return null

  const unknown = getUnknownNamespaces(blueprint)
  if (unknown.length === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-amber-950/70 border-b border-amber-800 text-amber-200 text-xs shrink-0">
      <span className="text-amber-400 text-base leading-none">⚠</span>
      <p className="flex-1">
        <strong className="text-amber-300">Unknown mods in palette:</strong>{' '}
        {unknown.map((ns) => (
          <code
            key={ns}
            className="mx-0.5 px-1 py-0.5 rounded bg-amber-900/60 text-amber-300 font-mono"
          >
            {ns}
          </code>
        ))}
        <span className="text-amber-400/80">
          {' '}— blocks will render as colour swatches. Import a resource pack for textures.
        </span>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-200 text-base leading-none px-1"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
