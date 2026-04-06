export default function SpecViewer({ spec }) {
  if (!spec) return <div className="text-muted">No spec data available</div>;

  const data = spec.spec_json || spec;

  return (
    <div>
      <div className="spec-field">
        <div className="field-label">Challenge Name</div>
        <div className="field-value" style={{ fontSize: '18px', fontWeight: 700 }}>{data.challenge_name || '-'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="spec-field">
          <div className="field-label">Category</div>
          <div className="field-value mono" style={{ textTransform: 'capitalize' }}>{data.category || '-'}</div>
        </div>
        <div className="spec-field">
          <div className="field-label">Difficulty</div>
          <div className="field-value mono" style={{ textTransform: 'capitalize' }}>{data.difficulty || '-'}</div>
        </div>
        <div className="spec-field">
          <div className="field-label">Points</div>
          <div className="field-value mono">{data.points || '-'}</div>
        </div>
      </div>

      <div className="spec-field">
        <div className="field-label">Narrative</div>
        <div className="field-value">{data.narrative || '-'}</div>
      </div>

      <div className="spec-field">
        <div className="field-label">Tech Stack</div>
        <div className="tag-list">
          {(data.tech_stack || []).map((t, i) => <span key={i} className="tag">{t}</span>)}
        </div>
      </div>

      <div className="spec-field">
        <div className="field-label">Vulnerability</div>
        <div className="field-value mono">
          {data.vulnerability?.type || '-'} {data.vulnerability?.cwe ? `(${data.vulnerability.cwe})` : ''}
        </div>
      </div>

      <div className="spec-field">
        <div className="field-label">Exploit Path</div>
        <ol style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {(data.exploit_path || []).map((step, i) => <li key={i} style={{ marginBottom: '4px' }}>{step}</li>)}
        </ol>
      </div>

      <div className="spec-field">
        <div className="field-label">Flags</div>
        <div className="tag-list">
          {(data.flags || []).map((f, i) => (
            <span key={i} className="tag" style={{ color: 'var(--accent-teal)' }}>{f}</span>
          ))}
        </div>
      </div>

      <div className="spec-field">
        <div className="field-label">Hints</div>
        <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {(data.hints || []).map((h, i) => <li key={i} style={{ marginBottom: '4px' }}>{h}</li>)}
        </ul>
      </div>

      <div className="spec-field">
        <div className="field-label">Anti-AI Measures</div>
        <div className="tag-list">
          {(data.anti_ai_measures || []).map((m, i) => (
            <span key={i} className="tag" style={{ color: 'var(--accent-coral)' }}>{m}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="spec-field">
          <div className="field-label">Estimated Time</div>
          <div className="field-value mono">{data.estimated_time || '-'}</div>
        </div>
        <div className="spec-field">
          <div className="field-label">Files Needed</div>
          <div className="field-value mono">{(data.files_needed || []).join(', ')}</div>
        </div>
      </div>

      {spec.token_usage != null && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '24px' }}>
          <div className="spec-field">
            <div className="field-label">Tokens Used</div>
            <div className="field-value mono">{spec.token_usage}</div>
          </div>
          <div className="spec-field">
            <div className="field-label">Generation Time</div>
            <div className="field-value mono">{spec.generation_time_ms}ms</div>
          </div>
        </div>
      )}
    </div>
  );
}
