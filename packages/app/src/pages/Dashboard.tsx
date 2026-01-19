import { useEffect, useState } from 'react';
import { getRestaurants, getPosts, triggerExpirePosts } from '../api';
import type { Restaurant, Post } from '../types';

export default function Dashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [restaurantsData, postsData] = await Promise.all([
        getRestaurants(),
        getPosts(),
      ]);
      setRestaurants(restaurantsData);
      setPosts(postsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpirePosts = async () => {
    setExpiring(true);
    try {
      const result = await triggerExpirePosts();
      setToast({
        type: 'success',
        message: `Wygaszono ${result.success} z ${result.total} postów`,
      });
      loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Błąd: ${err}`,
      });
    } finally {
      setExpiring(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const activePosts = posts.filter((p) => p.status === 'ACTIVE').length;
  const pendingPosts = posts.filter((p) => p.status === 'PENDING').length;
  const expiredPosts = posts.filter((p) => p.status === 'EXPIRED').length;

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
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Przegląd systemu Meta Ads Autopilot</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <span className="stat-label">Restauracje</span>
          <span className="stat-value accent">{restaurants.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Aktywne posty</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>{activePosts}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Oczekujące</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>{pendingPosts}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Wygaszone</span>
          <span className="stat-value" style={{ color: 'var(--text-muted)' }}>{expiredPosts}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Akcje</h2>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleExpirePosts}
          disabled={expiring}
        >
          {expiring ? 'Wygaszanie...' : '🔄 Wygaś przeterminowane posty'}
        </button>
        <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Automatycznie uruchamiane codziennie o 00:01
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Ostatnie posty</h2>
        </div>
        {posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>Brak postów. Posty pojawią się po otrzymaniu webhooka z Ayrshare.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Post ID</th>
                  <th>Kategoria</th>
                  <th>Status</th>
                  <th>Koniec promocji</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {posts.slice(0, 10).map((post) => (
                  <tr key={post.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      ...{post.meta_post_id.slice(-10)}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{post.category_code || '-'}</span>
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
                    <td>{post.promotion_end_date || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(post.created_at).toLocaleDateString('pl')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
