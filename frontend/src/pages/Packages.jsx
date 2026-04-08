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

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PackageCard({ job }) {
  const [pkgInfo, setPkgInfo] = useState(null);

  useEffect(() => {
    get(`/packages/${job.id}/info`).then(setPkgInfo).catch(() => {});
  }, [job.id]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

      {/* Dual download buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: '12px' }}
          onClick={() => window.open(`/api/packages/${job.id}/specialist`, '_blank')}
          title="Full package: source, writeup, config, exploit, DUNGEON config"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: '4px', verticalAlign: '-2px' }}>
            <path d="M8 2v8M4 7l4 4 4-4" />
            <path d="M2 12v2h12v-2" />
          </svg>
          Specialist
          {pkgInfo?.specialistSize ? <span style={{ opacity: 0.7, marginLeft: '4px', fontSize: '10px' }}>({formatSize(pkgInfo.specialistSize)})</span> : null}
        </button>
        <button
          className="btn"
          style={{ flex: 1, fontSize: '12px', background: 'rgba(100, 255, 218, 0.1)', color: 'var(--accent-teal)', border: '1px solid rgba(100, 255, 218, 0.2)' }}
          onClick={() => window.open(`/api/packages/${job.id}/participant`, '_blank')}
          title="Participant package: description + category files only (no flags)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: '4px', verticalAlign: '-2px' }}>
            <path d="M8 2v8M4 7l4 4 4-4" />
            <path d="M2 12v2h12v-2" />
          </svg>
          Participant
          {pkgInfo?.participantSize ? <span style={{ opacity: 0.7, marginLeft: '4px', fontSize: '10px' }}>({formatSize(pkgInfo.participantSize)})</span> : null}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <Link
          to={`/jobs/${job.id}`}
          className="btn btn-secondary"
          style={{ flex: 1, textAlign: 'center', fontSize: '12px' }}
        >
          Details
        </Link>
      </div>
    </div>
  );
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {jobs.map((job) => (
            <PackageCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
