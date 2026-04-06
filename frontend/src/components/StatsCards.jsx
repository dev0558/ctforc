export default function StatsCards({ stats }) {
  if (!stats) return null;

  const pipeline = stats.byStatus || {};

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Jobs</div>
          <div className="value">{stats.totalJobs || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Jobs Today</div>
          <div className="value teal">{stats.jobsToday || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Tokens Used</div>
          <div className="value">{(stats.totalTokens || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Est. Cost</div>
          <div className="value amber">${stats.estimatedCost || '0.00'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Approval Rate</div>
          <div className="value teal">{stats.approvalRate || 0}%</div>
        </div>
      </div>
      <div className="card mb-24">
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          Pipeline Overview
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            ['queued', 'Queued'],
            ['researching', 'Researching'],
            ['pending_spec_review', 'Spec Review'],
            ['spec_approved', 'Approved'],
            ['building', 'Building'],
            ['pending_build_review', 'Build Review'],
            ['ready', 'Ready'],
            ['failed', 'Failed'],
            ['rejected', 'Rejected'],
          ].map(([key, label]) => (
            <div key={key} style={{ textAlign: 'center', minWidth: '80px' }}>
              <div className={`mono`} style={{ fontSize: '22px', fontWeight: 700, color: `var(--text-primary)` }}>
                {pipeline[key] || 0}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
