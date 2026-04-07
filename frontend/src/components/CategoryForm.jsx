import { useState } from 'react';

export default function CategoryForm({ category, onSubmit }) {
  const [mode, setMode] = useState('idea');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState(
    category.difficulties?.[1]?.level || 'medium'
  );
  const [cveText, setCveText] = useState('');
  const [extraFields, setExtraFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateExtra(name, value) {
    setExtraFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'cve') {
        const cveIds = cveText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (cveIds.length === 0) {
          setError('Enter at least one CVE ID');
          setLoading(false);
          return;
        }
        await onSubmit({ mode: 'cve', cveIds });
      } else {
        // Build description with extra field context
        let fullDescription = description;
        const extras = Object.entries(extraFields).filter(([, v]) => v && v !== 'false');
        if (extras.length > 0) {
          fullDescription += '\n\nAdditional specifications:\n';
          fullDescription += extras
            .map(([key, val]) => {
              const field = category.formFields?.find((f) => f.name === key);
              const label = field?.label || key;
              if (val === 'true' || val === true) return `- ${label}: Yes`;
              return `- ${label}: ${val}`;
            })
            .join('\n');
        }

        if (fullDescription.trim().length < 10) {
          setError('Description must be at least 10 characters');
          setLoading(false);
          return;
        }

        await onSubmit({ mode: 'idea', description: fullDescription, difficulty });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const difficultyInfo = category.difficulties?.find((d) => d.level === difficulty);

  return (
    <div>
      {/* Category header */}
      <div className="card mb-24" style={{ borderLeft: `3px solid ${category.color}` }}>
        <div className="flex items-center gap-16">
          <div>
            <h3 style={{ margin: 0, color: category.color }}>{category.name}</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {category.description}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {category.defaultTechStack?.map((t, i) => (
            <span key={i} className="tag">{t}</span>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="tabs mb-16">
        <button className={`tab ${mode === 'idea' ? 'active' : ''}`} onClick={() => setMode('idea')}>
          Custom Idea
        </button>
        <button className={`tab ${mode === 'cve' ? 'active' : ''}`} onClick={() => setMode('cve')}>
          CVE Batch
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'cve' ? (
          <div className="card mb-24">
            <div className="field-label mb-8">CVE IDs (one per line)</div>
            <textarea
              value={cveText}
              onChange={(e) => setCveText(e.target.value)}
              placeholder="CVE-2023-22527&#10;CVE-2024-50379"
              rows={4}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              All CVEs will be categorized as {category.name}
            </div>
          </div>
        ) : (
          <>
            {/* Challenge description */}
            <div className="card mb-24">
              <div className="field-label mb-8">Challenge Description</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={category.exampleIdeas?.[0] || 'Describe your challenge idea...'}
                rows={4}
                style={{ width: '100%' }}
              />
              {category.exampleIdeas && category.exampleIdeas.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    EXAMPLE IDEAS
                  </div>
                  {category.exampleIdeas.map((idea, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDescription(idea)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        marginBottom: '4px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                      }}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Difficulty selector */}
            <div className="card mb-24">
              <div className="field-label mb-8">Difficulty</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(category.difficulties || []).map((d) => (
                  <button
                    key={d.level}
                    type="button"
                    onClick={() => setDifficulty(d.level)}
                    className={`difficulty-btn ${difficulty === d.level ? 'active' : ''}`}
                  >
                    <span className="difficulty-level">{d.level}</span>
                    <span className="difficulty-points">{d.points.join('-')} pts</span>
                    <span className="difficulty-time">{d.estimatedMinutes} min</span>
                  </button>
                ))}
              </div>
              {difficultyInfo && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {difficultyInfo.description}
                </div>
              )}
            </div>

            {/* Category-specific fields */}
            {category.formFields && category.formFields.length > 0 && (
              <div className="card mb-24">
                <div className="field-label mb-8" style={{ marginBottom: '16px' }}>
                  {category.name} Options
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {category.formFields.map((field) => (
                    <div key={field.name}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        {field.label}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={extraFields[field.name] || ''}
                          onChange={(e) => updateExtra(field.name, e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">-- Select --</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                          <input
                            type="checkbox"
                            checked={extraFields[field.name] === true || extraFields[field.name] === 'true'}
                            onChange={(e) => updateExtra(field.name, e.target.checked)}
                            style={{ width: 'auto' }}
                          />
                          Enabled
                        </label>
                      ) : (
                        <input
                          type="text"
                          value={extraFields[field.name] || ''}
                          onChange={(e) => updateExtra(field.name, e.target.value)}
                          style={{ width: '100%' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Output files preview */}
        {category.outputFiles && (
          <div className="card mb-24" style={{ opacity: 0.7 }}>
            <div className="field-label mb-8">Expected Output Files</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {category.outputFiles.map((f, i) => (
                <span key={i} className="tag mono" style={{ fontSize: '11px' }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--accent-coral)', fontSize: '13px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '10px 24px', fontSize: '14px' }}>
          {loading ? 'Submitting...' : 'Create Challenge'}
        </button>
      </form>
    </div>
  );
}
