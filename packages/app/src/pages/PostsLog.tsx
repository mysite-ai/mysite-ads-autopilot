import { useEffect, useState } from 'react';
import { getRestaurants, getPosts, getAdSets, addManualPost, retryPost, deletePost, pausePost, activatePost } from '../api';
import type { Restaurant, Post, AdSet } from '../types';

export default function PostsLog() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ restaurant_id: '', post_id: '', content: '' });
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getRestaurants(), getPosts(), getAdSets()])
      .then(([r, p, a]) => { setRestaurants(r); setPosts(p); setAdSets(a); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await addManualPost(form);
      setForm({ ...form, post_id: '', content: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryPost(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Błąd');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć reklamę z Meta i z bazy?')) return;
    try {
      await deletePost(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Błąd');
    }
  };

  const handleToggle = async (post: Post) => {
    try {
      if (post.status === 'ACTIVE') {
        await pausePost(post.id);
      } else {
        await activatePost(post.id);
      }
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Błąd');
    }
  };

  if (loading) return <div className="loading">Ładowanie...</div>;

  const filtered = filter ? posts.filter(p => p.restaurant_id === filter) : posts;
  const getRestaurantName = (id: string) => restaurants.find(r => r.id === id)?.name || 'Nieznana';
  const getAdSetName = (id: string | null) => id ? adSets.find(a => a.id === id)?.name || '-' : '-';

  return (
    <div>
      <div className="flex-between">
        <h1>Reklamy ({posts.length})</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Anuluj' : '+ Dodaj post'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Dodaj post ręcznie</h2>
          {error && <div className="error" style={{ color: 'red', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label>Restauracja</label>
                <select value={form.restaurant_id} onChange={e => setForm({...form, restaurant_id: e.target.value})} required>
                  <option value="">Wybierz...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Post ID (Facebook)</label>
                <input value={form.post_id} onChange={e => setForm({...form, post_id: e.target.value})} placeholder="np. 123456789012345" required />
              </div>
            </div>
            <div className="form-group">
              <label>Treść posta (do kategoryzacji)</label>
              <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={3} required />
            </div>
            <button type="submit" className="btn btn-primary">Dodaj i przetwórz</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 15 }}>
          <h2>Lista reklam ({filtered.length})</h2>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
            <option value="">Wszystkie</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="empty">Brak reklam{filter ? ' dla wybranej restauracji' : ''}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Restauracja</th>
                <th>Post ID</th>
                <th>Kategoria</th>
                <th>Ad Set</th>
                <th>Status</th>
                <th>Data końca</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{getRestaurantName(p.restaurant_id)}</td>
                  <td><code>{p.meta_post_id?.slice(-10)}</code></td>
                  <td><code>{p.category_code || '-'}</code></td>
                  <td><code>{getAdSetName(p.ad_set_id)}</code></td>
                  <td>
                    <span className={`badge badge-${
                      p.status === 'ACTIVE' ? 'success' : 
                      p.status === 'PAUSED' ? 'secondary' : 
                      p.status === 'PENDING' ? 'warning' : 'danger'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.promotion_end_date || '-'}</td>
                  <td className="flex">
                    {p.status === 'PENDING' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRetry(p.id)}>Ponów</button>
                    )}
                    {p.meta_ad_id && p.status !== 'PENDING' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(p)}>
                        {p.status === 'ACTIVE' ? 'Pauza' : 'Włącz'}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Usuń</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
