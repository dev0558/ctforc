import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client';
import StatusBadge from '../components/StatusBadge';

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function downloadPackage(jobId) {
  // Trigger browser download via the backend ZIP endpoint
  window.open(`/api/packages/${jobId}`, '_blank');
}

export default function Packages() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');

  const fetchReady = useCallback(async () => {
    try {
      const res = await get('/jobs?status=ready');
      setJobs(res.jobs || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchReady();
    const interval = setInterval(fetchReady, 5000);
    return () => clearInterval(interval);
  }, [fetchReady]);

  return (
    <div>
      <div className="page-header">
        <h2>Packages</h2>
        <div className="breadcrumb">Completed Challenge Downloads</div>
      </div>

      {error && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}>
          Backend unavailable: {error}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-teal)' }}>{jobs.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ready to Download</div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <svg width="48" height="48" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <rect x="2" y="4" width="12" height="10" rx="1" />
            <path d="M5 4V2h6v2" />
            <line x1="6" y1="8" x2="10" y2="8" />
          </svg>
          <div style={{ marginBottom: '8px' }}>No completed packages yet.</div>
          <div style={{ fontSize: '13px' }}>
            Challenges move here after passing both spec and build reviews.
            <br />
            <Link to="/queue" style={{ color: 'var(--accent-teal)' }}>Check the queue</Link> for challenges in progress.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {jobs.map((job) => (
            <div key={job.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                    {job.cve_id || job.idea_text?.substring(0, 50) || 'Challenge'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ textTransform: 'capitalize', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {job.category || 'unknown'}
                    </span>
                    {job.difficulty && (
                      <>
                        <span style={{ color: 'var(--border-color)' }}>|</span>
                        <span style={{ textTransform: 'capitalize', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {job.difficulty}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={job.status} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span className="mono">{job.id.substring(0, 8)}</span>
                <span>{timeAgo(job.created_at)}</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => downloadPackage(job.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                    <path d="M8 2v8M4 7l4 4 4-4" />
                    <path d="M2 12v2h12v-2" />
                  </svg>
                  Download ZIP
                </button>
                <Link
                  to={`/jobs/${job.id}`}
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px' }}
                >
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
