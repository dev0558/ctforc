export default function SpecViewer({ spec }) {
  if (!spec) return <div className="text-muted">No spec data available</div>;

  const data = spec.spec_json || spec;

  // Support both camelCase (Phase 2) and snake_case (Phase 1 mock) field names
  const name = data.challengeName || data.challenge_name || '-';
  const techStack = data.techStack || data.tech_stack || [];
  const exploitPath = data.exploitPath || data.exploit_path || [];
  const flag = data.flag || (data.flags && data.flags[0]) || null;
  const honeypotFlag = data.honeypotFlag || null;
  const antiAi = data.antiAiCountermeasures || data.anti_ai_measures || [];
  const reviewerNote = data.reviewerNote || data.reviewer_note || null;
  const estimatedTime = data.estimatedBuildTimeMin ? `${data.estimatedBuildTimeMin} min` : data.estimated_time || '-';
  const learningObjective = data.learningObjective || null;
  const toolsRequired = data.toolsRequired || [];
  const vulnType = data.vulnerability?.type || data.cwe?.name || '-';
  const vulnCwe = data.vulnerability?.cwe || data.cwe?.id || '';
  const cvss = data.cvss || data.vulnerability || null;

  return (
    <div>
      <div className="spec-field">
        <div className="field-label">Challenge Name</div>
        <div className="field-value" style={{ fontSize: '18px', fontWeight: 700 }}>{name}</div>
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
          {techStack.map((t, i) => <span key={i} className="tag">{t}</span>)}
        </div>
      </div>

      {(vulnType !== '-' || vulnCwe) && (
        <div className="spec-field">
          <div className="field-label">Vulnerability</div>
          <div className="field-value mono">
            {vulnType} {vulnCwe ? `(${vulnCwe})` : ''}
          </div>
        </div>
      )}

      {cvss?.score != null && (
        <div className="spec-field">
          <div className="field-label">CVSS</div>
          <div className="field-value mono">
            {cvss.score} ({cvss.severity || '-'}) | Vector: {cvss.vector || '-'} | Complexity: {cvss.complexity || '-'}
          </div>
        </div>
      )}

      <div className="spec-field">
        <div className="field-label">Exploit Path</div>
        <ol style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {exploitPath.map((step, i) => <li key={i} style={{ marginBottom: '4px' }}>{step}</li>)}
        </ol>
      </div>

      <div className="spec-field">
        <div className="field-label">Flag</div>
        <div className="tag-list">
          {flag && <span className="tag" style={{ color: 'var(--accent-teal)' }}>{flag}</span>}
          {!flag && data.flags?.map((f, i) => (
            <span key={i} className="tag" style={{ color: 'var(--accent-teal)' }}>{f}</span>
          ))}
        </div>
      </div>

      {honeypotFlag && (
        <div className="spec-field">
          <div className="field-label">Honeypot Flag (Decoy)</div>
          <div className="tag-list">
            <span className="tag" style={{ color: 'var(--accent-amber)' }}>{honeypotFlag}</span>
          </div>
        </div>
      )}

      {data.hints && data.hints.length > 0 && (
        <div className="spec-field">
          <div className="field-label">Hints</div>
          <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {data.hints.map((h, i) => <li key={i} style={{ marginBottom: '4px' }}>{h}</li>)}
          </ul>
        </div>
      )}

      <div className="spec-field">
        <div className="field-label">Anti-AI Countermeasures</div>
        <div className="tag-list">
          {antiAi.map((m, i) => (
            <span key={i} className="tag" style={{ color: 'var(--accent-coral)' }}>{m}</span>
          ))}
        </div>
      </div>

      {learningObjective && (
        <div className="spec-field">
          <div className="field-label">Learning Objective</div>
          <div className="field-value">{learningObjective}</div>
        </div>
      )}

      {toolsRequired.length > 0 && (
        <div className="spec-field">
          <div className="field-label">Tools Required</div>
          <div className="tag-list">
            {toolsRequired.map((t, i) => <span key={i} className="tag">{t}</span>)}
          </div>
        </div>
      )}

      {reviewerNote && (
        <div className="spec-field">
          <div className="field-label">Reviewer Note</div>
          <div className="field-value" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{reviewerNote}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="spec-field">
          <div className="field-label">Estimated Time</div>
          <div className="field-value mono">{estimatedTime}</div>
        </div>
        <div className="spec-field">
          <div className="field-label">Files Needed</div>
          <div className="field-value mono">{(data.files_needed || []).join(', ') || '-'}</div>
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
