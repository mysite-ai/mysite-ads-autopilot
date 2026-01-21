import { useEffect, useState } from 'react';
import { getRestaurants, getPosts, getAdSets, getOpportunities, addManualPost, retryPost, deletePost, pausePost, activatePost } from '../api';
import type { Restaurant, Post, AdSet, Opportunity } from '../types';

export default function PostsLog() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ restaurant_id: '', post_id: '', content: '' });
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getRestaurants(), getPosts(), getAdSets(), getOpportunities()])
      .then(([r, p, a, o]) => { setRestaurants(r); setPosts(p); setAdSets(a); setOpportunities(o); })
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
  
  const getRestaurant = (id: string) => restaurants.find(r => r.id === id);
  const getAdSet = (id: string | null) => id ? adSets.find(a => a.id === id) : null;
  const getOpportunity = (pk: number | null) => pk ? opportunities.find(o => o.pk === pk) : null;

  return (
    <div>
      <div className="flex-between">
        <h1>4. Reklamy ({posts.length})</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Anuluj' : '+ Dodaj post'}
        </button>
      </div>

      {/* CONTEXT */}
      <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 13, color: '#666' }}>
        <strong>Co to jest:</strong> Reklama to promowany post FB. System bierze istniejący post z FB i tworzy z niego reklamę w Meta Ads.
        <br/><strong>Flow:</strong> Wklejasz Post ID + treść → LLM kategoryzuje (np. "LU_ONS") → system tworzy Okazję (PK) → tworzy Ad Set → tworzy Creative + Ad z URL tracking.
        <br/><strong>Powiązania:</strong> Reklama należy do: Restauracji (RID) → Okazji (PK) → Ad Setu → i ma własne Meta IDs (post, creative, ad).
        <br/><strong>URL Tracking:</strong> Każda reklama ma parametry <code>r={'{RID}'}&c=.pi1.pk{'{PK}'}.ps{'{{'+'ad.id}}'}&utm_*</code>
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
                <th>Opportunity (PK)</th>
                <th>Ad Set</th>
                <th>Kategoria</th>
                <th>Meta IDs</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const restaurant = getRestaurant(p.restaurant_id);
                const adSet = getAdSet(p.ad_set_id);
                const opportunity = getOpportunity(p.pk);
                
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{restaurant?.name || 'Nieznana'}</strong>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        rid={restaurant?.rid} / {restaurant?.slug}
                      </div>
                    </td>
                    <td>
                      {opportunity ? (
                        <>
                          <strong style={{ color: '#2563eb' }}>pk{opportunity.pk}</strong>
                          <div style={{ fontSize: 11, color: '#666' }}>
                            {opportunity.name} ({opportunity.offer_type})
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td>
                      {adSet ? (
                        <>
                          <code style={{ fontSize: 11 }}>{adSet.name}</code>
                          <div style={{ fontSize: 11, color: '#666' }}>
                            v{adSet.version} / {adSet.ads_count} ads
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td><code>{p.category_code || '-'}</code></td>
                    <td style={{ fontSize: 11 }}>
                      <div title={p.meta_post_id}>post: ...{p.meta_post_id?.slice(-8)}</div>
                      {p.meta_ad_id && <div title={p.meta_ad_id}>ad: ...{p.meta_ad_id.slice(-8)}</div>}
                      {p.meta_creative_id && <div title={p.meta_creative_id}>crv: ...{p.meta_creative_id.slice(-8)}</div>}
                    </td>
                    <td>
                      <span className={`badge badge-${
                        p.status === 'ACTIVE' ? 'success' : 
                        p.status === 'PAUSED' ? 'secondary' : 
                        p.status === 'PENDING' ? 'warning' : 'danger'
                      }`}>
                        {p.status}
                      </span>
                      {p.promotion_end_date && (
                        <div style={{ fontSize: 10, color: '#666' }}>do {p.promotion_end_date}</div>
                      )}
                    </td>
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
