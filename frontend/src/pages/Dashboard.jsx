import { useState, useEffect, useCallback } from 'react';
import { get } from '../api/client';
import StatsCards from '../components/StatsCards';
import SubmitForm from '../components/SubmitForm';
import JobTable from '../components/JobTable';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, statsRes] = await Promise.all([
        get('/jobs'),
        get('/stats'),
      ]);
      setJobs(jobsRes.jobs || []);
      setStats(statsRes);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <div className="breadcrumb">CTF Challenge Pipeline</div>
      </div>

      {error && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}>
          Backend unavailable: {error}
        </div>
      )}

      <StatsCards stats={stats} />
      <SubmitForm onSubmitted={fetchData} />
      <JobTable jobs={jobs} />
    </div>
  );
}
