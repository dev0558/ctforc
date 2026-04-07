import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client';
import StatusBadge from '../components/StatusBadge';

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'researching', label: 'Researching' },
  { value: 'pending_spec_review', label: 'Pending Spec Review' },
  { value: 'spec_approved', label: 'Spec Approved' },
  { value: 'building', label: 'Building' },
  { value: 'pending_build_review', label: 'Pending Build Review' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
];

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'web', label: 'Web' },
  { value: 'forensics', label: 'Forensics' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'osint', label: 'OSINT' },
  { value: 'network', label: 'Network' },
  { value: 'pwn', label: 'Pwn' },
];

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

function getActionButton(job) {
  if (job.status === 'pending_spec_review') {
    return <Link to={`/review/spec/${job.id}`} className="btn btn-primary" style={{ fontSize: '11px', padding: '4px 10px' }}>Review Spec</Link>;
  }
  if (job.status === 'pending_build_review') {
    return <Link to={`/review/build/${job.id}`} className="btn btn-primary" style={{ fontSize: '11px', padding: '4px 10px' }}>Review Build</Link>;
  }
  if (job.status === 'ready') {
    return <Link to={`/packages`} className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>Package</Link>;
  }
  return <Link to={`/jobs/${job.id}`} className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>Details</Link>;
}

export default function Queue() {
  const [jobs, setJobs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [error, setError] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      const qs = params.toString();
      const res = await get(`/jobs${qs ? '?' + qs : ''}`);
      setJobs(res.jobs || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [filterStatus, filterCategory]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const activeCount = jobs.filter((j) => ['queued', 'researching', 'building'].includes(j.status)).length;
  const reviewCount = jobs.filter((j) => ['pending_spec_review', 'pending_build_review'].includes(j.status)).length;

  return (
    <div>
      <div className="page-header">
        <h2>Queue</h2>
        <div className="breadcrumb">Job Processing Pipeline</div>
      </div>

      {error && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}>
          Backend unavailable: {error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-teal)' }}>{jobs.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Jobs</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-amber)' }}>{activeCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Processing</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-coral)' }}>{reviewCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Needs Review</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-24" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filter</div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-input"
          style={{ minWidth: '180px' }}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="form-input"
          style={{ minWidth: '150px' }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Job table */}
      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No jobs found{filterStatus || filterCategory ? ' matching the current filters' : ''}. Go to <Link to="/create" style={{ color: 'var(--accent-teal)' }}>Create Challenge</Link> to submit new challenges.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>CVE / Idea</th>
                <th>Category</th>
                <th>Difficulty</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="mono" style={{ fontSize: '12px' }}>
                    <Link to={`/jobs/${job.id}`} style={{ color: 'var(--accent-teal)', textDecoration: 'none' }}>
                      {job.id.substring(0, 8)}
                    </Link>
                  </td>
                  <td>
                    {job.cve_id ? (
                      <span className="mono" style={{ color: 'var(--accent-teal)', fontSize: '13px' }}>{job.cve_id}</span>
                    ) : (
                      <span style={{ fontSize: '13px' }}>{job.idea_text?.substring(0, 40)}{job.idea_text?.length > 40 ? '...' : ''}</span>
                    )}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{job.category || '-'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{job.difficulty || '-'}</td>
                  <td><StatusBadge status={job.status} /></td>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{timeAgo(job.created_at)}</td>
                  <td>{getActionButton(job)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
