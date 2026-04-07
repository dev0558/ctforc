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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Load categories
  useEffect(() => {
    async function load() {
      try {
        const res = await get('/categories');
        setCategories(res.categories || []);

        // If category is in URL query, pre-select it
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

  // Load category detail when selected
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

  async function handleSubmit(formData) {
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

      const res = await post('/implement', body);
      navigate('/', { state: { submitted: true, batchId: res.batch_id } });
    } catch (err) {
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

      {!selectedCategory ? (
        /* Category selection grid */
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
        /* Category-specific form */
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
