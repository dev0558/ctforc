import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post } from '../api/client';
import SpecViewer from '../components/SpecViewer';
import StatusBadge from '../components/StatusBadge';

export default function SpecReview() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await get(`/specs/${jobId}`);
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
    if (action === 'reject' && (!rejectNotes || rejectNotes.trim().length === 0)) {
      setError('Feedback is required when rejecting for rework. Provide notes explaining what to fix.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body = { action };
      if ((action === 'reject' || action === 'reject_final') && rejectNotes) {
        body.notes = rejectNotes;
      }
      await post(`/specs/${jobId}/review`, body);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-muted">Loading...</div>;
  if (error && !data) return <div style={{ color: 'var(--accent-coral)' }}>Error: {error}</div>;
  if (!data) return <div className="text-muted">Not found</div>;

  const { job, spec } = data;
  const canReview = job.status === 'pending_spec_review';
  const revision = job.spec_revision || 1;
  const isRework = revision > 1;
  const maxRevisionsReached = revision >= 3;
  const specJson = spec?.spec_json || {};

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2>Spec Review</h2>
          {isRework && (
            <span style={{
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255, 165, 0, 0.15)',
              color: '#ffa500',
            }}>
              Revision {revision}/3
            </span>
          )}
        </div>
        <div className="breadcrumb">
          Job {job.id.substring(0, 8)} / {job.cve_id || 'Custom Idea'} / <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Duplicate warning banner */}
      {specJson.duplicateWarning && (
        <div className="card mb-24" style={{
          borderColor: specJson.duplicateWarning.isDuplicate ? 'var(--accent-coral)' : 'var(--accent-amber)',
          background: specJson.duplicateWarning.isDuplicate ? 'rgba(255, 107, 107, 0.05)' : 'rgba(255, 217, 61, 0.05)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: specJson.duplicateWarning.isDuplicate ? 'var(--accent-coral)' : 'var(--accent-amber)' }}>
            {specJson.duplicateWarning.isDuplicate ? 'Duplicate Warning (High Confidence)' : 'Similar Challenge Detected'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Score: {specJson.duplicateWarning.highestScore}/100
          </div>
          {specJson.duplicateWarning.similarChallenges?.map((sc, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {sc.challengeName} ({sc.category}/{sc.difficulty}) — {sc.similarityScore}pts: {sc.reasons.join(', ')}
            </div>
          ))}
        </div>
      )}

      {/* Reviewer note from AI rework */}
      {specJson.reviewerNote && isRework && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-blue)', background: 'rgba(87, 203, 255, 0.05)' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--accent-blue)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            AI Revision Notes
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {specJson.reviewerNote}
          </div>
        </div>
      )}

      <div className="review-panel">
        <div className="card">
          <SpecViewer spec={spec} />
        </div>

        <div>
          <div className="card">
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
              Review Actions
            </div>

            {error && (
              <div style={{ color: 'var(--accent-coral)', fontSize: '12px', marginBottom: '12px', padding: '8px', background: 'rgba(255, 107, 107, 0.1)', borderRadius: '4px' }}>
                {error}
              </div>
            )}

            {canReview ? (
              <div className="review-actions">
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => handleReview('approve')}
                  disabled={submitting}
                >
                  Approve Spec
                </button>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Feedback {maxRevisionsReached ? '(max revisions reached)' : '(required for rework)'}
                  </div>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="What needs to be fixed? Be specific..."
                    rows={3}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />

                  {!maxRevisionsReached && (
                    <button
                      className="btn btn-danger"
                      style={{ width: '100%', justifyContent: 'center', marginBottom: '8px' }}
                      onClick={() => handleReview('reject')}
                      disabled={submitting || !rejectNotes.trim()}
                    >
                      Reject &amp; Rework (Rev {revision + 1}/3)
                    </button>
                  )}

                  <button
                    className="btn"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      background: 'rgba(255, 50, 50, 0.2)',
                      color: '#ff3232',
                    }}
                    onClick={() => handleReview('reject_final')}
                    disabled={submitting}
                  >
                    {maxRevisionsReached ? 'Reject Permanently' : 'Reject Permanently (Skip Rework)'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: '13px' }}>
                {job.status === 'reworking_spec' ? (
                  <div>
                    <div style={{ color: '#ffa500', fontWeight: 600, marginBottom: '4px' }}>AI is reworking this spec...</div>
                    <div>Revision {revision}/3 in progress. The page will update when done.</div>
                  </div>
                ) : (
                  'This spec has already been reviewed.'
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
