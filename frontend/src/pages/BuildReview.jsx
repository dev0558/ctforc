import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function BuildReview() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(0);
  const [rejectNotes, setRejectNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await get(`/challenges/${jobId}`);
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  async function handleReview(action) {
    setSubmitting(true);
    try {
      const body = { action };
      if (action === 'reject' && rejectNotes) {
        body.notes = rejectNotes;
      }
      await post(`/challenges/${jobId}/review`, body);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-muted">Loading...</div>;
  if (error) return <div style={{ color: 'var(--accent-coral)' }}>Error: {error}</div>;
  if (!data) return <div className="text-muted">Not found</div>;

  const { job, spec, challenge } = data;
  const files = challenge?.file_manifest || [];
  const canReview = job.status === 'pending_build_review';

  return (
    <div>
      <div className="page-header">
        <h2>Build Review</h2>
        <div className="breadcrumb">
          Job {job.id.substring(0, 8)} / {job.cve_id || 'Custom Idea'} / <StatusBadge status={job.status} />
        </div>
      </div>

      {spec?.spec_json && (
        <div className="card mb-24" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div className="field-label">Challenge</div>
            <div style={{ fontWeight: 600 }}>{spec.spec_json.challenge_name}</div>
          </div>
          <div>
            <div className="field-label">Category</div>
            <div className="mono" style={{ textTransform: 'capitalize' }}>{spec.spec_json.category}</div>
          </div>
          <div>
            <div className="field-label">Difficulty</div>
            <div className="mono" style={{ textTransform: 'capitalize' }}>{spec.spec_json.difficulty}</div>
          </div>
          <div>
            <div className="field-label">Points</div>
            <div className="mono">{spec.spec_json.points}</div>
          </div>
        </div>
      )}

      <div className="review-panel">
        <div>
          {/* File tabs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
              {files.map((file, i) => (
                <button
                  key={i}
                  className={`tab ${selectedFile === i ? 'active' : ''}`}
                  onClick={() => setSelectedFile(i)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {file.path}
                </button>
              ))}
            </div>
            <div style={{ padding: '16px' }}>
              {files[selectedFile] ? (
                <div className="code-block">
                  <span className="filename">{files[selectedFile].path} ({files[selectedFile].language})</span>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {files[selectedFile].content}
                  </pre>
                </div>
              ) : (
                <div className="text-muted">No files in manifest</div>
              )}
            </div>
          </div>

          {challenge?.token_usage != null && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span className="mono">Tokens: {challenge.token_usage}</span>
              <span className="mono">Generation: {challenge.generation_time_ms}ms</span>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
              Review Actions
            </div>

            {canReview ? (
              <div className="review-actions">
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => handleReview('approve')}
                  disabled={submitting}
                >
                  Approve Build
                </button>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Rejection feedback..."
                    rows={3}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => handleReview('reject')}
                    disabled={submitting}
                  >
                    Reject Build
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: '13px' }}>
                This build has already been reviewed.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
