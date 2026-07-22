import { useMemo } from 'react'
import { useBlueprintStore } from '@/store/blueprintStore'
import { validateBlueprint, type Issue, type Severity } from '@/lib/blueprint/validate'

const DOT_COLOR: Record<Severity, string> = {
  error: '#e05555',
  warning: '#e0a84a',
  info: '#6a6870',
}

export default function ValidationTab() {
  const blueprint = useBlueprintStore((s) => s.blueprint)
  const ghostBlueprint = useBlueprintStore((s) => s.ghostBlueprint)

  const issues = useMemo(
    () => (blueprint ? validateBlueprint(blueprint, ghostBlueprint) : []),
    [blueprint, ghostBlueprint],
  )

  if (!blueprint) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {issues.length === 0 && (
        <div style={{
          background: '#232326', border: '1px solid #33333a', borderRadius: 8, padding: 12,
          fontSize: 12.5, color: '#6fae6f',
        }}>
          ✔ No issues found
        </div>
      )}
      {issues.map((v) => (
        <IssueCard key={v.id} issue={v} />
      ))}
    </div>
  )
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div style={{
      display: 'flex', gap: 10,
      background: '#232326', border: '1px solid #33333a', borderRadius: 8, padding: 12,
    }}>
      <div style={{
        width: 9, height: 9, borderRadius: 5, marginTop: 3, flexShrink: 0,
        background: DOT_COLOR[issue.severity],
      }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e8e6e3' }}>{issue.message}</div>
        {issue.detail && (
          <div style={{ fontSize: 11.5, color: '#8a8892', marginTop: 2 }}>{issue.detail}</div>
        )}
      </div>
    </div>
  )
}
