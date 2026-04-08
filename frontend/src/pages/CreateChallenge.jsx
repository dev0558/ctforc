import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get, post } from '../api/client';
import CategoryCard from '../components/CategoryCard';
import CategoryForm from '../components/CategoryForm';

export default function CreateChallenge() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryDetail, setCategoryDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dupWarning, setDupWarning] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    async function load() {
      try {
        const res = await get('/categories');
        setCategories(res.categories || []);

        const preselect = searchParams.get('category');
        if (preselect) {
          setSelectedCategory(preselect);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCategory) {
      setCategoryDetail(null);
      return;
    }
    async function loadDetail() {
      try {
        const res = await get(`/categories/${selectedCategory}`);
        setCategoryDetail(res);
      } catch (err) {
        setError(err.message);
      }
    }
    loadDetail();
  }, [selectedCategory]);

  async function handleSubmit(formData, force = false) {
    setError('');
    setDupWarning(null);

    try {
      const body = {
        mode: formData.mode || 'idea',
        items: formData.mode === 'cve'
          ? formData.cveIds
          : [{
              description: formData.description,
              category: selectedCategory,
              difficulty: formData.difficulty,
            }],
      };

      if (force) {
        body.force = true;
      }

      const res = await post('/implement', body);
      navigate('/', { state: { submitted: true, batchId: res.batch_id } });
    } catch (err) {
      // Check for duplicate CVE response (409)
      if (err.response && err.response.status === 409) {
        try {
          const dupData = typeof err.response.data === 'string' ? JSON.parse(err.response.data) : err.response.data;
          setDupWarning({ formData, duplicates: dupData.duplicates || [] });
          return;
        } catch {
          // Fall through to generic error
        }
      }
      // Also check if the error message contains duplicate info
      if (err.message && err.message.includes('Duplicate CVEs')) {
        setDupWarning({ formData, duplicates: [] });
        return;
      }
      throw err;
    }
  }

  if (loading) return <div className="text-muted">Loading categories...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Create Challenge</h2>
        <div className="breadcrumb">Select a category to build a new CTF challenge</div>
      </div>

      {error && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}>
          {error}
        </div>
      )}

      {/* CVE Duplicate Warning */}
      {dupWarning && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-amber)', background: 'rgba(255, 217, 61, 0.05)' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent-amber)' }}>
            Duplicate CVEs Detected
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            The following CVEs already have existing jobs. You can force-submit to create them anyway.
          </div>
          {dupWarning.duplicates.map((d, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span className="mono" style={{ color: 'var(--accent-amber)' }}>{d.cveId}</span>
              {' — '}Job {d.existing.jobId?.substring(0, 8)} ({d.existing.status})
            </div>
          ))}
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleSubmit(dupWarning.formData, true)}
            >
              Force Submit Anyway
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setDupWarning(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!selectedCategory ? (
        <div className="category-grid">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              onClick={() => setSelectedCategory(cat.id)}
            />
          ))}
        </div>
      ) : (
        <div>
          <button
            className="btn btn-secondary mb-24"
            onClick={() => setSelectedCategory(null)}
            style={{ fontSize: '12px' }}
          >
            &larr; Back to Categories
          </button>

          {categoryDetail && (
            <CategoryForm
              category={categoryDetail}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      )}
    </div>
  );
}
