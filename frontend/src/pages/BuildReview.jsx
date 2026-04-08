import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post } from '../api/client';
import StatusBadge from '../components/StatusBadge';

/**
 * Group flat file paths into a tree structure for the sidebar.
 */
function buildFileTree(filePaths) {
  const tree = {};
  for (const fp of filePaths) {
    const parts = fp.split('/');
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node[part] = null;
      } else {
        if (!node[part]) node[part] = {};
        node = node[part];
      }
    }
  }
  return tree;
}

function FileTreeNode({ name, node, depth, prefix, selectedPath, onSelect }) {
  const fullPath = prefix ? `${prefix}/${name}` : name;
  const isFile = node === null;
  const isSelected = fullPath === selectedPath;

  if (isFile) {
    return (
      <button
        onClick={() => onSelect(fullPath)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '4px 8px 4px ' + (12 + depth * 14) + 'px',
          background: isSelected ? 'rgba(100, 255, 218, 0.1)' : 'transparent',
          border: 'none',
          borderLeft: isSelected ? '2px solid var(--accent-teal)' : '2px solid transparent',
          color: isSelected ? 'var(--accent-teal)' : 'var(--text-secondary)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
        }}
      >
        {name}
      </button>
    );
  }

  return (
    <div>
      <div style={{ padding: '4px 8px 4px ' + (12 + depth * 14) + 'px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {name}/
      </div>
      {Object.entries(node)
        .sort(([, a], [, b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
        .map(([childName, childNode]) => (
          <FileTreeNode
            key={childName}
            name={childName}
            node={childNode}
            depth={depth + 1}
            prefix={fullPath}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export default function BuildReview() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [diskFiles, setDiskFiles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await get(`/challenges/${jobId}`);
        setData(res);

        try {
          const fileRes = await get(`/challenge-files/${jobId}`);
          if (fileRes.totalFiles > 0) {
            setDiskFiles(fileRes.files);
          }
        } catch {
          // Disk files may not exist for older/mock challenges
        }
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
      await post(`/challenges/${jobId}/review`, body);
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

  const { job, spec, challenge } = data;
  const canReview = job.status === 'pending_build_review';
  const revision = job.build_revision || 1;
  const isRework = revision > 1;
  const maxRevisionsReached = revision >= 3;

  // Merge file sources: prefer disk files, fall back to DB manifest
  let files = {};
  let filePaths = [];

  if (diskFiles && Object.keys(diskFiles).length > 0) {
    files = diskFiles;
    filePaths = Object.keys(diskFiles).sort();
  } else if (challenge?.file_manifest && Array.isArray(challenge.file_manifest)) {
    for (const f of challenge.file_manifest) {
      files[f.path] = { content: f.content, language: f.language, size: f.content?.length || 0 };
    }
    filePaths = challenge.file_manifest.map((f) => f.path);
  }

  if (!selectedPath && filePaths.length > 0) {
    const preferred = filePaths.find((f) => f.includes('WRITEUP') || f.includes('writeup.md'))
      || filePaths.find((f) => f.includes('app.py') || f.includes('app.js'))
      || filePaths[0];
    setSelectedPath(preferred);
  }

  const selectedFile = files[selectedPath];
  const fileTree = buildFileTree(filePaths);
  const specJson = spec?.spec_json || {};
  const challengeName = specJson.challengeName || specJson.challenge_name || 'Challenge';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2>Build Review</h2>
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
              Build Rev {revision}/3
            </span>
          )}
        </div>
        <div className="breadcrumb">
          Job {job.id.substring(0, 8)} / {job.cve_id || challengeName} / <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Challenge summary */}
      <div className="card mb-24" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div className="field-label">Challenge</div>
          <div style={{ fontWeight: 600 }}>{challengeName}</div>
        </div>
        <div>
          <div className="field-label">Category</div>
          <div className="mono" style={{ textTransform: 'capitalize' }}>{specJson.category || job.category || '-'}</div>
        </div>
        <div>
          <div className="field-label">Difficulty</div>
          <div className="mono" style={{ textTransform: 'capitalize' }}>{specJson.difficulty || '-'}</div>
        </div>
        <div>
          <div className="field-label">Points</div>
          <div className="mono">{specJson.points || '-'}</div>
        </div>
        <div>
          <div className="field-label">Files</div>
          <div className="mono">{filePaths.length}</div>
        </div>
        <div>
          <div className="field-label">Tokens</div>
          <div className="mono">{challenge?.token_usage || 0}</div>
        </div>
        <div>
          <div className="field-label">Build Time</div>
          <div className="mono">{challenge?.generation_time_ms ? `${(challenge.generation_time_ms / 1000).toFixed(1)}s` : '-'}</div>
        </div>
      </div>

      {/* File viewer with tree sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: '16px', alignItems: 'start' }}>
        {/* File tree sidebar */}
        <div className="card" style={{ padding: '8px 0', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
            Files ({filePaths.length})
          </div>
          {Object.entries(fileTree)
            .sort(([, a], [, b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
            .map(([name, node]) => (
              <FileTreeNode
                key={name}
                name={name}
                node={node}
                depth={0}
                prefix=""
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            ))}
        </div>

        {/* File content viewer */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '13px', color: 'var(--accent-teal)' }}>{selectedPath || 'No file selected'}</span>
            {selectedFile && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {selectedFile.language} | {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)}KB` : ''}
              </span>
            )}
          </div>
          <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
            {selectedFile ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                {selectedFile.content}
              </pre>
            ) : (
              <div className="text-muted" style={{ textAlign: 'center', padding: '40px' }}>
                {filePaths.length > 0 ? 'Select a file from the tree' : 'No files generated'}
              </div>
            )}
          </div>
        </div>

        {/* Review actions */}
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
                  Approve Build
                </button>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
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
                      Reject &amp; Rework (Build Rev {revision + 1}/3)
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
                {job.status === 'reworking_build' ? (
                  <div>
                    <div style={{ color: '#ffa500', fontWeight: 600, marginBottom: '4px' }}>AI is reworking this build...</div>
                    <div>Build revision {revision}/3 in progress.</div>
                  </div>
                ) : (
                  'This build has already been reviewed.'
                )}
              </div>
            )}
          </div>

          {/* Flag info */}
          {specJson.flag && (
            <div className="card" style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Flags
              </div>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Real Flag</div>
                <div className="mono" style={{ fontSize: '12px', color: 'var(--accent-teal)', wordBreak: 'break-all' }}>{specJson.flag}</div>
              </div>
              {specJson.honeypotFlag && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Honeypot (Decoy)</div>
                  <div className="mono" style={{ fontSize: '12px', color: 'var(--accent-coral)', wordBreak: 'break-all' }}>{specJson.honeypotFlag}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
