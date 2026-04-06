import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getReviewLink(job) {
  if (job.status === 'pending_spec_review') {
    return <Link to={`/review/spec/${job.id}`} className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>Review Spec</Link>;
  }
  if (job.status === 'pending_build_review') {
    return <Link to={`/review/build/${job.id}`} className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>Review Build</Link>;
  }
  return <Link to={`/jobs/${job.id}`} className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>Details</Link>;
}

export default function JobTable({ jobs }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        No jobs yet. Submit CVEs or ideas above to get started.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>CVE / Idea</th>
            <th>Category</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {job.id.substring(0, 8)}
              </td>
              <td>
                {job.cve_id ? (
                  <span className="mono" style={{ color: 'var(--accent-teal)', fontSize: '13px' }}>{job.cve_id}</span>
                ) : (
                  <span style={{ fontSize: '13px' }}>{job.idea_text?.substring(0, 40)}{job.idea_text?.length > 40 ? '...' : ''}</span>
                )}
              </td>
              <td style={{ textTransform: 'capitalize' }}>{job.category || '-'}</td>
              <td><StatusBadge status={job.status} /></td>
              <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {timeAgo(job.created_at)}
              </td>
              <td>{getReviewLink(job)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
