import { useState } from 'react';
import { post } from '../api/client';

const CATEGORIES = ['web', 'forensics', 'crypto', 'osint', 'network', 'pwn'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];

export default function SubmitForm({ onSubmitted }) {
  const [mode, setMode] = useState('cve');
  const [cveText, setCveText] = useState('');
  const [ideaDesc, setIdeaDesc] = useState('');
  const [ideaCategory, setIdeaCategory] = useState('web');
  const [ideaDifficulty, setIdeaDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let body;
      if (mode === 'cve') {
        const items = cveText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (items.length === 0) {
          setError('Enter at least one CVE ID');
          setLoading(false);
          return;
        }
        body = { mode: 'cve', items };
      } else {
        if (ideaDesc.trim().length < 10) {
          setError('Description must be at least 10 characters');
          setLoading(false);
          return;
        }
        body = {
          mode: 'idea',
          items: [{ description: ideaDesc, category: ideaCategory, difficulty: ideaDifficulty }],
        };
      }

      await post('/implement', body);
      setCveText('');
      setIdeaDesc('');
      if (onSubmitted) onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mb-24">
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
        Submit Challenge
      </div>
      <div className="tabs">
        <button className={`tab ${mode === 'cve' ? 'active' : ''}`} onClick={() => setMode('cve')}>
          CVE Batch
        </button>
        <button className={`tab ${mode === 'idea' ? 'active' : ''}`} onClick={() => setMode('idea')}>
          Custom Idea
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        {mode === 'cve' ? (
          <div>
            <textarea
              value={cveText}
              onChange={(e) => setCveText(e.target.value)}
              placeholder="CVE-2023-22527&#10;CVE-2024-50379&#10;CVE-2023-44487"
              rows={4}
              style={{ width: '100%', marginBottom: '12px' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              One CVE ID per line. Format: CVE-YYYY-NNNNN
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
            <textarea
              value={ideaDesc}
              onChange={(e) => setIdeaDesc(e.target.value)}
              placeholder="Describe your challenge idea (e.g., PCAP with DNS tunneling exfiltration)"
              rows={3}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
                <select value={ideaCategory} onChange={(e) => setIdeaCategory(e.target.value)} style={{ width: '100%' }}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Difficulty</label>
                <select value={ideaDifficulty} onChange={(e) => setIdeaDifficulty(e.target.value)} style={{ width: '100%' }}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        {error && <div style={{ color: 'var(--accent-coral)', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
