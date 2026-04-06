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
    setSubmitting(true);
    try {
      const body = { action };
      if (action === 'reject' && rejectNotes) {
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
  if (error) return <div style={{ color: 'var(--accent-coral)' }}>Error: {error}</div>;
  if (!data) return <div className="text-muted">Not found</div>;

  const { job, spec } = data;
  const canReview = job.status === 'pending_spec_review';

  return (
    <div>
      <div className="page-header">
        <h2>Spec Review</h2>
        <div className="breadcrumb">
          Job {job.id.substring(0, 8)} / {job.cve_id || 'Custom Idea'} / <StatusBadge status={job.status} />
        </div>
      </div>

      <div className="review-panel">
        <div className="card">
          <SpecViewer spec={spec} />
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
                  Approve Spec
                </button>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Rejection reason..."
                    rows={3}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => handleReview('reject')}
                    disabled={submitting}
                  >
                    Reject Spec
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: '13px' }}>
                This spec has already been reviewed.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
