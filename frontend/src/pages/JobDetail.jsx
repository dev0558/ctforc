import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import SpecViewer from '../components/SpecViewer';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <div className="text-muted">Loading...</div>;
  if (error) return <div style={{ color: 'var(--accent-coral)' }}>Error: {error}</div>;
  if (!job) return <div className="text-muted">Job not found</div>;

  const STATUS_ORDER = [
    'queued', 'researching', 'pending_spec_review', 'spec_approved',
    'building', 'pending_build_review', 'ready'
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
            <div className="field-label">Retries</div>
            <div className="mono">{job.retry_count}</div>
          </div>
        </div>
        {job.error_message && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,107,107,0.1)', borderRadius: '6px', color: 'var(--accent-coral)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            {job.error_message}
          </div>
        )}
      </div>

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
          {(job.status === 'failed' || job.status === 'rejected') && (
            <div className="timeline-item active">
              <div className="event" style={{ fontWeight: 700 }}>
                <StatusBadge status={job.status} />
              </div>
              <div className="time">{new Date(job.updated_at + 'Z').toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* Spec */}
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
            Built Files
          </div>
          {(job.challenge.file_manifest || []).map((file, i) => (
            <div key={i} className="code-block" style={{ marginBottom: '12px' }}>
              <span className="filename">{file.path} ({file.language})</span>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{file.content}</pre>
            </div>
          ))}
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
                <span className={`badge ${review.action === 'reject' ? 'badge-rejected' : 'badge-ready'}`}>
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
