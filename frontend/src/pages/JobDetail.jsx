import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import SpecViewer from '../components/SpecViewer';

const TABS = ['overview', 'history'];

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());

  useEffect(() => {
    async function load() {
      try {
        const res = await get(`/jobs/${id}`);
        setJob(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (tab === 'history' && !history) {
      setHistoryLoading(true);
      get(`/jobs/${id}/history`)
        .then(setHistory)
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }, [tab, id, history]);

  function toggleExpand(idx) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  if (loading) return <div className="text-muted">Loading...</div>;
  if (error) return <div style={{ color: 'var(--accent-coral)' }}>Error: {error}</div>;
  if (!job) return <div className="text-muted">Job not found</div>;

  const STATUS_ORDER = [
    'queued', 'researching', 'architecting', 'pending_spec_review', 'spec_approved',
    'developing', 'pending_build_review', 'ready'
  ];
  const currentIdx = STATUS_ORDER.indexOf(job.status);

  return (
    <div>
      <div className="page-header">
        <h2>Job Detail</h2>
        <div className="breadcrumb">
          <Link to="/" style={{ color: 'var(--accent-teal)', textDecoration: 'none' }}>Dashboard</Link>
          {' / '}Job {job.id.substring(0, 8)}
        </div>
      </div>

      {/* Job summary */}
      <div className="card mb-24">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
          <div>
            <div className="field-label">Job ID</div>
            <div className="mono" style={{ fontSize: '12px' }}>{job.id}</div>
          </div>
          <div>
            <div className="field-label">CVE / Idea</div>
            <div style={{ fontWeight: 600 }}>{job.cve_id || job.idea_text || '-'}</div>
          </div>
          <div>
            <div className="field-label">Category</div>
            <div style={{ textTransform: 'capitalize' }}>{job.category || '-'}</div>
          </div>
          <div>
            <div className="field-label">Difficulty</div>
            <div style={{ textTransform: 'capitalize' }}>{job.difficulty || '-'}</div>
          </div>
          <div>
            <div className="field-label">Status</div>
            <StatusBadge status={job.status} />
          </div>
          <div>
            <div className="field-label">Revisions</div>
            <div className="mono">Spec: {job.spec_revision || 1}/3 | Build: {job.build_revision || 1}/3</div>
          </div>
        </div>
        {job.error_message && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,107,107,0.1)', borderRadius: '6px', color: 'var(--accent-coral)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            {job.error_message}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px',
              background: tab === t ? 'var(--card-bg)' : 'transparent',
              color: tab === t ? 'var(--accent-teal)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent-teal)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: tab === t ? 600 : 400,
              textTransform: 'capitalize',
              fontSize: '13px',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Timeline */}
          <div className="card mb-24">
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
              Pipeline Progress
            </div>
            <div className="timeline">
              {STATUS_ORDER.map((status, i) => {
                const isActive = i <= currentIdx;
                const isCurrent = status === job.status;
                return (
                  <div key={status} className={`timeline-item ${isActive ? 'active' : ''}`}>
                    <div className="event" style={{ fontWeight: isCurrent ? 700 : 400 }}>
                      <StatusBadge status={status} />
                    </div>
                    {isCurrent && job.updated_at && (
                      <div className="time">{new Date(job.updated_at + 'Z').toLocaleString()}</div>
                    )}
                  </div>
                );
              })}
              {['failed', 'rejected', 'rejected_final'].includes(job.status) && (
                <div className="timeline-item active">
                  <div className="event" style={{ fontWeight: 700 }}>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="time">{new Date(job.updated_at + 'Z').toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>

          {/* Research Analysis (Stage 1) */}
          {job.analysis && job.analysis.analysis_json && job.analysis.analysis_json.type !== 'idea' && (
            <div className="card mb-24">
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-purple, #c084fc)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                Researcher Analysis
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="spec-field">
                  <div className="field-label">CVE</div>
                  <div className="field-value mono">{job.analysis.analysis_json.cveId || '-'}</div>
                </div>
                <div className="spec-field">
                  <div className="field-label">Vulnerability Type</div>
                  <div className="field-value">{job.analysis.analysis_json.vulnerability?.type || '-'}</div>
                </div>
              </div>
              {job.analysis.analysis_json.affectedTechnology && (
                <div className="spec-field" style={{ marginBottom: '12px' }}>
                  <div className="field-label">Immutable Technology</div>
                  <div className="tag-list">
                    {(job.analysis.analysis_json.affectedTechnology.techStack || []).map((t, i) => (
                      <span key={i} className="tag" style={{ color: 'var(--accent-purple, #c084fc)' }}>{t}</span>
                    ))}
                    {job.analysis.analysis_json.affectedTechnology.language && (
                      <span className="tag" style={{ color: 'var(--accent-amber)' }}>{job.analysis.analysis_json.affectedTechnology.language}</span>
                    )}
                  </div>
                </div>
              )}
              {job.analysis.analysis_json.exploitation?.steps && (
                <div className="spec-field">
                  <div className="field-label">Exploitation Steps</div>
                  <ol style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {job.analysis.analysis_json.exploitation.steps.map((step, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {job.analysis.token_usage > 0 && (
                <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {job.analysis.token_usage} tokens | {job.analysis.generation_time_ms}ms
                </div>
              )}
            </div>
          )}

          {/* Spec (Stage 2: Architect) */}
          {job.spec && (
            <div className="card mb-24">
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                Challenge Spec
              </div>
              <SpecViewer spec={job.spec} />
            </div>
          )}

          {/* Challenge files */}
          {job.challenge && (
            <div className="card mb-24">
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                Built Files ({(job.challenge.file_manifest || []).length})
              </div>
              {(job.challenge.file_manifest || []).map((file, i) => (
                <div key={i} className="code-block" style={{ marginBottom: '12px' }}>
                  <span className="filename">{file.path} ({file.language})</span>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{file.content}</pre>
                </div>
              ))}
            </div>
          )}

          {/* Test Results */}
          {job.challenge?.test_results && (
            <div className="card mb-24">
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                Test Results
              </div>
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: job.challenge.test_results.overallPass ? 'rgba(100, 255, 218, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                color: job.challenge.test_results.overallPass ? 'var(--accent-teal)' : 'var(--accent-coral)',
                fontWeight: 600,
                fontSize: '13px',
                marginBottom: '8px',
              }}>
                {job.challenge.test_results.overallPass ? 'ALL TESTS PASSED' : 'TESTS FAILED'}
                {job.challenge.test_results.duration ? ` (${job.challenge.test_results.duration}ms)` : ''}
              </div>
            </div>
          )}

          {/* Reviews */}
          {job.reviews && job.reviews.length > 0 && (
            <div className="card">
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                Reviews
              </div>
              {job.reviews.map((review, i) => (
                <div key={i} style={{ padding: '12px', borderBottom: i < job.reviews.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div className="flex items-center gap-8" style={{ marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{review.stage} Review</span>
                    <span className={`badge ${review.action === 'reject' || review.action === 'reject_final' ? 'badge-rejected' : 'badge-ready'}`}>
                      {review.action}
                    </span>
                  </div>
                  {review.notes && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{review.notes}</div>}
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {new Date(review.created_at + 'Z').toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div>
          {historyLoading ? (
            <div className="text-muted">Loading history...</div>
          ) : !history ? (
            <div className="text-muted">Failed to load history</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-teal)' }}>{history.specVersions}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spec Versions</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-blue, #57cbff)' }}>{history.buildVersions}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Build Versions</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-amber)' }}>{history.totalReviews}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reviews</div>
                </div>
              </div>

              {/* Chronological timeline */}
              <div className="card">
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                  Chronological Timeline
                </div>
                {history.timeline.map((item, idx) => {
                  const expanded = expandedItems.has(idx);
                  const typeColors = {
                    spec_version: { bg: 'rgba(100, 255, 218, 0.08)', border: 'var(--accent-teal)', label: 'Spec v' + item.revision },
                    build_version: { bg: 'rgba(87, 203, 255, 0.08)', border: '#57cbff', label: 'Build v' + item.revision },
                    review: { bg: 'rgba(255, 217, 61, 0.08)', border: 'var(--accent-amber)', label: `${item.stage} ${item.action}` },
                  };
                  const tc = typeColors[item.type] || { bg: 'transparent', border: 'var(--border-color)', label: item.type };

                  return (
                    <div key={idx} style={{
                      padding: '12px',
                      marginBottom: '8px',
                      borderLeft: `3px solid ${tc.border}`,
                      background: tc.bg,
                      borderRadius: '0 6px 6px 0',
                      cursor: (item.type === 'spec_version' && item.data) || item.type === 'build_version' ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if ((item.type === 'spec_version' && item.data) || item.type === 'build_version') {
                        toggleExpand(idx);
                      }
                    }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>{tc.label}</span>
                          {item.tokenUsage && (
                            <span className="mono" style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.tokenUsage} tokens
                            </span>
                          )}
                          {item.fileCount > 0 && (
                            <span className="mono" style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.fileCount} files
                            </span>
                          )}
                        </div>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {item.timestamp ? new Date(item.timestamp + 'Z').toLocaleString() : '-'}
                        </span>
                      </div>
                      {item.feedback && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--accent-amber)', fontStyle: 'italic' }}>
                          Feedback: {item.feedback}
                        </div>
                      )}
                      {item.notes && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {item.notes}
                        </div>
                      )}
                      {expanded && item.type === 'spec_version' && item.data && (
                        <div style={{ marginTop: '12px' }} onClick={(e) => e.stopPropagation()}>
                          <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', maxHeight: '300px', overflow: 'auto' }}>
                            {typeof item.data === 'string' ? item.data : JSON.stringify(item.data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {expanded && item.type === 'build_version' && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }} onClick={(e) => e.stopPropagation()}>
                          Build revision {item.revision} with {item.fileCount} files
                        </div>
                      )}
                    </div>
                  );
                })}
                {history.timeline.length === 0 && (
                  <div className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>No history entries yet</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-12 mt-16">
        {job.status === 'pending_spec_review' && (
          <Link to={`/review/spec/${job.id}`} className="btn btn-primary">Review Spec</Link>
        )}
        {job.status === 'pending_build_review' && (
          <Link to={`/review/build/${job.id}`} className="btn btn-primary">Review Build</Link>
        )}
        <Link to="/" className="btn btn-secondary">Back to Dashboard</Link>
      </div>
    </div>
  );
}
