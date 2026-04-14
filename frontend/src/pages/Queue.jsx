import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../api/client';
import StatusBadge from '../components/StatusBadge';

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'researching', label: 'Researching' },
  { value: 'architecting', label: 'Architecting' },
  { value: 'pending_spec_review', label: 'Pending Spec Review' },
  { value: 'reworking_spec', label: 'Reworking Spec' },
  { value: 'spec_approved', label: 'Spec Approved' },
  { value: 'developing', label: 'Developing' },
  { value: 'pending_build_review', label: 'Pending Build Review' },
  { value: 'reworking_build', label: 'Reworking Build' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'rejected_final', label: 'Rejected (Final)' },
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

const BATCH_REVIEWABLE = ['pending_spec_review', 'pending_build_review'];

export default function Queue() {
  const [jobs, setJobs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

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

  const activeCount = jobs.filter((j) => ['queued', 'researching', 'architecting', 'developing'].includes(j.status)).length;
  const reviewCount = jobs.filter((j) => ['pending_spec_review', 'pending_build_review'].includes(j.status)).length;

  const reviewableJobs = jobs.filter((j) => BATCH_REVIEWABLE.includes(j.status));
  const selectedReviewable = [...selected].filter((id) => reviewableJobs.some((j) => j.id === id));
  const allReviewableSelected = reviewableJobs.length > 0 && reviewableJobs.every((j) => selected.has(j.id));

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allReviewableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reviewableJobs.map((j) => j.id)));
    }
  }

  async function handleBatchAction(action) {
    if (selectedReviewable.length === 0) return;
    setBatchSubmitting(true);
    setBatchResult(null);
    try {
      // Group by stage
      const specIds = selectedReviewable.filter((id) => {
        const j = jobs.find((j) => j.id === id);
        return j?.status === 'pending_spec_review';
      });
      const buildIds = selectedReviewable.filter((id) => {
        const j = jobs.find((j) => j.id === id);
        return j?.status === 'pending_build_review';
      });

      const results = [];
      if (specIds.length > 0) {
        const r = await post('/batch-review', { jobIds: specIds, stage: 'spec', action });
        results.push(r);
      }
      if (buildIds.length > 0) {
        const r = await post('/batch-review', { jobIds: buildIds, stage: 'build', action });
        results.push(r);
      }

      const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);
      setBatchResult({ success: true, message: `${action === 'approve' ? 'Approved' : 'Rejected'} ${totalProcessed} job(s)` });
      setSelected(new Set());
      fetchJobs();
    } catch (err) {
      setBatchResult({ success: false, message: err.message });
    } finally {
      setBatchSubmitting(false);
    }
  }

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

      {batchResult && (
        <div className="card mb-24" style={{
          borderColor: batchResult.success ? 'var(--accent-teal)' : 'var(--accent-coral)',
          color: batchResult.success ? 'var(--accent-teal)' : 'var(--accent-coral)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{batchResult.message}</span>
          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setBatchResult(null)}>✕</button>
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
        <>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '36px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allReviewableSelected}
                    onChange={toggleSelectAll}
                    title="Select all reviewable jobs"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
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
              {jobs.map((job) => {
                const isReviewable = BATCH_REVIEWABLE.includes(job.status);
                return (
                  <tr key={job.id} style={selected.has(job.id) ? { background: 'rgba(100, 255, 218, 0.05)' } : {}}>
                    <td style={{ textAlign: 'center' }}>
                      {isReviewable ? (
                        <input
                          type="checkbox"
                          checked={selected.has(job.id)}
                          onChange={() => toggleSelect(job.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      ) : (
                        <span style={{ opacity: 0.2 }}>-</span>
                      )}
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Floating batch action bar */}
        {selectedReviewable.length > 0 && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card-bg)',
            border: '1px solid var(--accent-teal)',
            borderRadius: '12px',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 100,
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-teal)' }}>
              {selectedReviewable.length} selected
            </span>
            <button
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 16px' }}
              onClick={() => handleBatchAction('approve')}
              disabled={batchSubmitting}
            >
              Approve Selected
            </button>
            <button
              className="btn btn-danger"
              style={{ fontSize: '12px', padding: '6px 16px' }}
              onClick={() => handleBatchAction('reject_final')}
              disabled={batchSubmitting}
            >
              Reject Selected
            </button>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
              onClick={() => setSelected(new Set())}
              title="Clear selection"
            >
              ✕
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
