import { useEffect, useState } from 'react';
import { getPosts, getRestaurants, pausePost, activatePost, addManualPost } from '../api';
import type { Post, Restaurant } from '../types';

export default function PostsLog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Manual post form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    restaurant_id: '',
    post_id: '',
    content: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [postsData, restaurantsData] = await Promise.all([
        getPosts(),
        getRestaurants(),
      ]);
      setPosts(postsData);
      setRestaurants(restaurantsData);
      
      // Set default restaurant for manual form
      if (restaurantsData.length > 0 && !manualForm.restaurant_id) {
        setManualForm(prev => ({ ...prev, restaurant_id: restaurantsData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePostStatus = async (post: Post) => {
    try {
      if (post.status === 'ACTIVE') {
        await pausePost(post.meta_post_id);
        setToast({ type: 'success', message: 'Post wstrzymany' });
      } else if (post.status === 'PAUSED') {
        await activatePost(post.meta_post_id);
        setToast({ type: 'success', message: 'Post aktywowany' });
      }
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: `Błąd: ${err}` });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.restaurant_id || !manualForm.post_id) {
      setToast({ type: 'error', message: 'Wypełnij wymagane pola' });
      return;
    }

    setSubmitting(true);
    try {
      await addManualPost(manualForm);
      setToast({ type: 'success', message: 'Post dodany i przetworzony!' });
      setShowManualForm(false);
      setManualForm(prev => ({ ...prev, post_id: '', content: '' }));
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: `Błąd: ${err}` });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const getRestaurantName = (id: string) => {
    const r = restaurants.find((r) => r.id === id);
    return r?.name || 'Nieznana';
  };

  const filteredPosts = posts.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (restaurantFilter !== 'all' && p.restaurant_id !== restaurantFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Ładowanie...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Historia postów</h1>
        <p className="page-subtitle">Przeglądaj i zarządzaj reklamowanymi postami</p>
      </div>

      {/* Manual Post Form */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🧪 Dodaj post manualnie (testowanie)</h2>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            {showManualForm ? 'Schowaj' : 'Pokaż formularz'}
          </button>
        </div>
        
        {showManualForm && (
          <form onSubmit={handleManualSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Restauracja *</label>
                <select
                  className="form-select"
                  value={manualForm.restaurant_id}
                  onChange={(e) => setManualForm({ ...manualForm, restaurant_id: e.target.value })}
                  required
                >
                  <option value="">Wybierz restaurację...</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Post ID (Meta) *</label>
                <input
                  type="text"
                  className="form-input"
                  value={manualForm.post_id}
                  onChange={(e) => setManualForm({ ...manualForm, post_id: e.target.value })}
                  placeholder="122110386309149400"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Treść posta (do kategoryzacji LLM)</label>
              <textarea
                className="form-input"
                value={manualForm.content}
                onChange={(e) => setManualForm({ ...manualForm, content: e.target.value })}
                placeholder="Wklej treść posta, aby LLM mógł go skategoryzować..."
                rows={4}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || restaurants.length === 0}
              >
                {submitting ? 'Przetwarzanie...' : '🚀 Dodaj i przetwórz post'}
              </button>
              {restaurants.length === 0 && (
                <span style={{ color: 'var(--warning)', alignSelf: 'center' }}>
                  ⚠️ Najpierw dodaj restaurację
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Posty ({filteredPosts.length})</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <select
              className="form-select"
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="all">Wszystkie restauracje</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="all">Wszystkie</option>
              <option value="ACTIVE">Aktywne</option>
              <option value="PENDING">Oczekujące</option>
              <option value="PAUSED">Wstrzymane</option>
              <option value="EXPIRED">Wygaszone</option>
            </select>
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>Brak postów. Użyj formularza powyżej, aby dodać post manualnie.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Restauracja</th>
                  <th>Post ID</th>
                  <th>Kategoria</th>
                  <th>Event</th>
                  <th>Koniec promo</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post.id}>
                    <td style={{ fontWeight: 500 }}>
                      {getRestaurantName(post.restaurant_id)}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      ...{post.meta_post_id.slice(-10)}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{post.category_code || '-'}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {post.event_date || '-'}
                    </td>
                    <td>
                      {post.promotion_end_date ? (
                        <span style={{
                          color: new Date(post.promotion_end_date) < new Date() 
                            ? 'var(--danger)' 
                            : 'var(--text-primary)'
                        }}>
                          {post.promotion_end_date}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`badge ${
                        post.status === 'ACTIVE' ? 'badge-success' :
                        post.status === 'PENDING' ? 'badge-warning' :
                        post.status === 'EXPIRED' ? 'badge-neutral' : 'badge-danger'
                      }`}>
                        {post.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(post.created_at).toLocaleDateString('pl')}
                    </td>
                    <td>
                      {(post.status === 'ACTIVE' || post.status === 'PAUSED') && (
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => togglePostStatus(post)}
                        >
                          {post.status === 'ACTIVE' ? 'Wstrzymaj' : 'Aktywuj'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Szczegóły treści</h2>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filteredPosts.slice(0, 5).map((post) => (
            <div
              key={post.id}
              style={{
                padding: 16,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {getRestaurantName(post.restaurant_id)} • {post.category_code}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {new Date(post.created_at).toLocaleString('pl')}
                </span>
              </div>
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '0.9375rem',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}>
                {post.content || '(brak treści)'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
