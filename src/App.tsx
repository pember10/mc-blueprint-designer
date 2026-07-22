import { useEffect, useState } from 'react'
import Toolbar from '@/components/layout/Toolbar'
import LeftPanel from '@/components/layout/LeftPanel'
import LayerGrid from '@/components/editor/LayerGrid'
import Preview3D from '@/components/editor/Preview3D'
import RightRail from '@/components/panels/RightRail'
import MissingModsBanner from '@/components/modding/MissingModsBanner'
import { useEditorStore } from '@/store/editorStore'
import { useBlueprintStore, makeEmptyBlueprint, resizeBlueprint } from '@/store/blueprintStore'
import { importResourcePack, getMemCacheSnapshot } from '@/lib/blocks/textures'
import { validateBlueprint } from '@/lib/blueprint/validate'

export default function App() {
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint)
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const ghostBlueprint = useBlueprintStore((s) => s.ghostBlueprint)

  const setTool = useEditorStore((s) => s.setTool)
  const activeLayer = useEditorStore((s) => s.activeLayer)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const toggleSymmetryX = useEditorStore((s) => s.toggleSymmetryX)
  const toggleSymmetryZ = useEditorStore((s) => s.toggleSymmetryZ)
  const showGhost = useEditorStore((s) => s.showGhost)
  const setShowGhost = useEditorStore((s) => s.setShowGhost)
  const setSelection = useEditorStore((s) => s.setSelection)
  const currentLevel = useEditorStore((s) => s.currentLevel)
  const settings = useEditorStore((s) => s.settings)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const toast = useEditorStore((s) => s.toast)
  const showSettings = useEditorStore((s) => s.showSettings)
  const setShowSettings = useEditorStore((s) => s.setShowSettings)
  const showResourcePack = useEditorStore((s) => s.showResourcePack)
  const setShowResourcePack = useEditorStore((s) => s.setShowResourcePack)
  const show3DModal = useEditorStore((s) => s.show3DModal)
  const setShow3DModal = useEditorStore((s) => s.setShow3DModal)
  const previewRotation = useEditorStore((s) => s.previewRotation)
  const setPreviewRotation = useEditorStore((s) => s.setPreviewRotation)
  const setTextureMap = useEditorStore((s) => s.setTextureMap)
  const showToast = useEditorStore((s) => s.showToast)

  // ── Computed status bar values ────────────────────────────────────────────

  const blockCount = blueprint
    ? (() => {
        let n = 0
        for (let y = 0; y < blueprint.sizeY; y++)
          for (let z = 0; z < blueprint.sizeZ; z++)
            for (let x = 0; x < blueprint.sizeX; x++)
              if ((blueprint.structure[y]?.[z]?.[x] ?? 0) !== 0) n++
        return n
      })()
    : 0

  const issues = blueprint ? validateBlueprint(blueprint, ghostBlueprint) : []
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const footprintMismatch =
    ghostBlueprint &&
    blueprint &&
    (ghostBlueprint.sizeX !== blueprint.sizeX || ghostBlueprint.sizeZ !== blueprint.sizeZ)

  const worstIssueLabel = errors > 0
    ? `${errors} error${errors > 1 ? 's' : ''}`
    : warnings > 0
      ? `${warnings} warning${warnings > 1 ? 's' : ''}`
      : '✔ OK'
  const worstIssueColor = errors > 0 ? '#e05555' : warnings > 0 ? '#e0a84a' : '#6fae6f'

  // ── Initialise default blueprint on mount ─────────────────────────────────

  useEffect(() => {
    const { gridX, gridZ, maxY } = settings
    const bp = makeEmptyBlueprint(gridX, maxY, gridZ)
    bp.meta.name = "Builder's Hut"
    bp.meta.fileName = 'buildershut'
    bp.meta.packName = ''
    bp.requiredMods = ['minecolonies', 'structurize']
    setBlueprint(bp)
    setActiveLayer(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const maxLayer = blueprint ? blueprint.sizeY - 1 : 0
      switch (e.key) {
        case 's': setTool('select'); break
        case 'p': setTool('place'); break
        case 'e': setTool('erase'); break
        case 'b': setTool('paint'); break
        case 'i': setTool('pick'); break
        case 't': setTool('tag'); break
        case 'w': setTool('wand'); break
        case 'x': toggleSymmetryX(); break
        case 'z': if (!e.ctrlKey && !e.metaKey) toggleSymmetryZ(); break
        case 'g': setShowGhost(!showGhost); break
        case '[': setActiveLayer(Math.max(0, activeLayer - 1)); break
        case ']': setActiveLayer(Math.min(maxLayer, activeLayer + 1)); break
        case 'Escape': setSelection(null); break
      }
      // Ctrl+Z / Ctrl+Y handled by zundo
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [setTool, toggleSymmetryX, toggleSymmetryZ, setShowGhost, showGhost, activeLayer, setActiveLayer, blueprint, setSelection])

  // ── Resource pack import ──────────────────────────────────────────────────

  const [rpProcessing, setRpProcessing] = useState(false)
  const [rpError, setRpError] = useState<string | null>(null)

  const handleResourcePackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRpProcessing(true)
    setRpError(null)
    try {
      const count = await importResourcePack(file)
      setTextureMap(getMemCacheSnapshot())
      showToast(`Resource pack loaded — ${count} texture${count !== 1 ? 's' : ''} matched`)
      setShowResourcePack(false)
    } catch (err) {
      setRpError(String(err))
    } finally {
      setRpProcessing(false)
    }
  }

  // ── Settings change: resize blueprint ────────────────────────────────────

  const handleSettingsChange = (patch: { maxY?: number; gridX?: number; gridZ?: number }) => {
    const next = { ...settings, ...patch }
    updateSettings(patch)
    if (blueprint && (patch.maxY !== undefined || patch.gridX !== undefined || patch.gridZ !== undefined)) {
      setBlueprint(resizeBlueprint(blueprint, next.gridX, next.maxY, next.gridZ))
      setActiveLayer(Math.min(activeLayer, next.maxY - 1))
    }
  }

  // ── Layer count for slider ────────────────────────────────────────────────

  const GYmax = (blueprint?.sizeY ?? settings.maxY) - 1

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#151517', color: '#e8e6e3',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: 'hidden', fontSize: 13,
    }}>
      {/* Missing mods banner */}
      <MissingModsBanner />

      {/* Toolbar */}
      <Toolbar />

      {/* Main 3-column area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Left panel */}
        <LeftPanel />

        {/* Center: grid + status */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, position: 'relative' }}>

          {/* Grid header */}
          <div style={{
            flexShrink: 0, padding: '12px 18px',
            borderBottom: '1px solid #2c2c30',
            fontSize: 12, fontWeight: 700, color: '#c8c6cf', letterSpacing: '0.03em',
          }}>
            LAYER GRID — Y: {activeLayer}
          </div>

          {/* Grid area (flex-1, fills remaining) */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', display: 'flex' }}>
            <LayerGrid />

            {/* 3D Preview overlay (top-right) */}
            <div style={{
              position: 'absolute', top: 16, right: 16,
              width: '33%', minWidth: 230, maxWidth: 340,
              background: 'rgba(26,26,29,.94)',
              border: '1px solid #33333a', borderRadius: 10,
              boxShadow: '0 14px 34px rgba(0,0,0,.5)',
              overflow: 'hidden',
              backdropFilter: 'blur(6px)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderBottom: '1px solid #2c2c30',
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: '#c8c6cf' }}>
                  3D PREVIEW — L{currentLevel}
                </div>
                <button
                  onClick={() => setShow3DModal(true)}
                  style={{ border: 'none', background: '#2c2c30', color: '#c8c6cf', borderRadius: 5, padding: '5px 9px', fontSize: 10.5, cursor: 'pointer', fontWeight: 600 }}
                >
                  ⤢ Expand
                </button>
              </div>
              <div style={{ height: 170, background: 'radial-gradient(circle at 50% 20%,#1d1d21,#131315)' }}>
                <Preview3D height={170} />
              </div>
            </div>
          </div>

          {/* Layer slider */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
            padding: '10px 18px', borderTop: '1px solid #2c2c30', background: '#17171a',
          }}>
            <div style={{ fontSize: 11, color: '#8a8892', whiteSpace: 'nowrap' }}>
              LAYER (Y: {activeLayer})
            </div>
            <input
              type="range"
              min={0}
              max={GYmax}
              value={activeLayer}
              onChange={(e) => setActiveLayer(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#8a6fd6' }}
            />
            <div style={{ fontSize: 10.5, color: '#5a5860', whiteSpace: 'nowrap' }}>
              Blocks at or below this layer are shown
            </div>
          </div>

          {/* Status bar */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18,
            padding: '8px 18px', borderTop: '1px solid #2c2c30',
            background: '#17171a', fontSize: 11.5, color: '#9a98a3',
          }}>
            <span><strong style={{ color: '#e8e6e3' }}>{blockCount.toLocaleString()}</strong> blocks placed</span>
            <span style={{ color: '#3a3a40' }}>|</span>
            <span>
              Footprint mismatch:{' '}
              <strong style={{ color: footprintMismatch ? '#e05555' : '#6fae6f' }}>
                {footprintMismatch ? 'Yes' : 'No'}
              </strong>
            </span>
            <span style={{ color: '#3a3a40' }}>|</span>
            <span>
              Status: <strong style={{ color: worstIssueColor }}>{worstIssueLabel}</strong>
            </span>
          </div>
        </div>

        {/* Right rail */}
        <RightRail />
      </div>

      {/* ── 3D Modal ── */}
      {show3DModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
        }}>
          <div style={{
            width: '74vw', maxWidth: 900, height: '74vh', maxHeight: 720,
            background: '#1c1c1f', border: '1px solid #33333a', borderRadius: 12,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid #2c2c30', flexShrink: 0,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e8e6e3' }}>
                3D Preview — Level {currentLevel}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setPreviewRotation((previewRotation + 3) % 4)}
                  style={{ border: '1px solid #33333a', borderRadius: 7, padding: '8px 12px', background: '#232326', color: '#c8c6cf', fontSize: 12.5, cursor: 'pointer' }}
                >
                  ⟲ Rotate
                </button>
                <button
                  onClick={() => setPreviewRotation((previewRotation + 1) % 4)}
                  style={{ border: '1px solid #33333a', borderRadius: 7, padding: '8px 12px', background: '#232326', color: '#c8c6cf', fontSize: 12.5, cursor: 'pointer' }}
                >
                  Rotate ⟳
                </button>
                <button
                  onClick={() => setShow3DModal(false)}
                  style={{ border: 'none', borderRadius: 7, padding: '8px 14px', background: '#8a6fd6', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, background: 'radial-gradient(circle at 50% 20%,#1d1d21,#131315)' }}>
              <Preview3D height={undefined} />
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55,
        }}>
          <div style={{ width: 400, background: '#1c1c1f', border: '1px solid #33333a', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Settings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Max Y */}
              <SettingCard>
                <SettingRow label="Max Y layers" value={settings.maxY} />
                <input
                  type="range" min={1} max={12} step={1}
                  value={settings.maxY}
                  onChange={(e) => handleSettingsChange({ maxY: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: '#8a6fd6' }}
                />
                <SettingHint>Changing this resizes the grid — blocks above the new height are removed.</SettingHint>
              </SettingCard>

              {/* Grid X */}
              <SettingCard>
                <SettingRow label="Grid width (X)" value={settings.gridX} />
                <input
                  type="range" min={2} max={32} step={1}
                  value={settings.gridX}
                  onChange={(e) => handleSettingsChange({ gridX: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: '#8a6fd6' }}
                />
                <SettingRow label="Grid depth (Z)" value={settings.gridZ} />
                <input
                  type="range" min={2} max={32} step={1}
                  value={settings.gridZ}
                  onChange={(e) => handleSettingsChange({ gridZ: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: '#8a6fd6' }}
                />
                <SettingHint>Footprint size, shared across all 5 levels. Resizing clears the selection and clipboard.</SettingHint>
              </SettingCard>

              {/* Toggles */}
              <SettingToggle
                label="Show tag markers on grid"
                value={settings.showTagMarkers}
                onChange={(v) => updateSettings({ showTagMarkers: v })}
              />
              <SettingToggle
                label="Highlight mirrored cells on hover"
                value={settings.showMirrorPreview}
                onChange={(v) => updateSettings({ showMirrorPreview: v })}
              />
              <SettingToggle
                label="Reduce motion (toasts, transitions)"
                value={settings.reduceMotion}
                onChange={(v) => updateSettings({ reduceMotion: v })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{ border: 'none', borderRadius: 7, padding: '9px 16px', background: '#8a6fd6', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resource Pack Modal ── */}
      {showResourcePack && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{ width: 380, background: '#1c1c1f', border: '1px solid #33333a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Import Resource Pack</div>
            <div style={{ fontSize: 12.5, color: '#8a8892', marginBottom: 16 }}>
              Upload a Minecraft resource-pack .zip. PNG textures are matched by block name and rendered on swatches and the layer grid.
            </div>
            {rpProcessing && (
              <div style={{ fontSize: 12.5, color: '#c8c6cf', padding: '14px 0', textAlign: 'center' }}>
                Reading zip and matching textures…
              </div>
            )}
            {rpError && (
              <div style={{ fontSize: 12, color: '#e0a84a', marginBottom: 12 }}>{rpError}</div>
            )}
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px dashed #3a3a40', borderRadius: 8, padding: 22,
              cursor: 'pointer', color: '#8a8892', fontSize: 12.5, marginBottom: 16,
            }}>
              Click to choose a .zip file
              <input type="file" accept=".zip" onChange={handleResourcePackFile} style={{ display: 'none' }} />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResourcePack(false)}
                style={{ border: '1px solid #33333a', borderRadius: 7, padding: '9px 14px', background: 'transparent', color: '#c8c6cf', fontSize: 12.5, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 26,
          transform: 'translateX(-50%)',
          background: '#232326', border: '1px solid #3a3a40',
          color: '#e8e6e3', padding: '11px 18px', borderRadius: 9,
          fontSize: 12.5, boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          animation: 'toastIn 0.18s ease',
          zIndex: 100, pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Settings modal sub-components ──────────────────────────────────────────

function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #33333a', borderRadius: 7, padding: '11px 14px', background: '#232326' }}>
      {children}
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: '#c8c6cf', marginBottom: 8 }}>
      <span>{label}</span>
      <span style={{ color: '#e8e6e3', fontWeight: 700 }}>{value}</span>
    </div>
  )
}

function SettingHint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, color: '#6a6870', marginTop: 6 }}>{children}</div>
}

function SettingToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: '1px solid #33333a', borderRadius: 7, padding: '11px 14px',
        fontSize: 12.5, cursor: 'pointer', background: '#232326', color: '#c8c6cf',
        width: '100%',
      }}
    >
      <span>{label}</span>
      <span style={{ width: 34, height: 18, borderRadius: 9, background: value ? '#8a6fd6' : '#33333a' }} />
    </button>
  )
}
