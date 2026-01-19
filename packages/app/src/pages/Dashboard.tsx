import { useEffect, useState } from 'react';
import { getRestaurants, getPosts, getAdSets, retryCampaignCreation, deleteRestaurant } from '../api';
import type { Restaurant } from '../types';

export default function Dashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [stats, setStats] = useState({ posts: 0, adSets: 0, active: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [r, p, a] = await Promise.all([getRestaurants(), getPosts(), getAdSets()]);
      setRestaurants(r);
      setStats({
        posts: p.length,
        adSets: a.length,
        active: p.filter(x => x.status === 'ACTIVE').length,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRetry = async (id: string) => {
    try {
      await retryCampaignCreation(id);
      loadData();
    } catch (e) {
      alert(`Błąd: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć restaurację "${name}"? Kampania pozostanie w Meta.`)) return;
    try {
      await deleteRestaurant(id);
      loadData();
    } catch (e) {
      alert(`Błąd: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (loading) return <div className="loading">Ładowanie...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="stats">
        <div className="stat">
          <div className="stat-value">{restaurants.length}</div>
          <div className="stat-label">Restauracji</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.adSets}</div>
          <div className="stat-label">Ad Setów</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.posts}</div>
          <div className="stat-label">Reklam</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Aktywnych</div>
        </div>
      </div>

      <div className="card">
        <h2>Restauracje ({restaurants.length})</h2>
        {restaurants.length === 0 ? (
          <p className="empty">Brak restauracji. Dodaj pierwszą w zakładce "Restauracje".</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Kod</th>
                <th>Region</th>
                <th>FB Page</th>
                <th>IG</th>
                <th>Kampania</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td><code>{r.code}</code></td>
                  <td>{r.area}</td>
                  <td><code>{r.facebook_page_id}</code></td>
                  <td>{r.instagram_account_id ? '✓' : '-'}</td>
                  <td>
                    {r.meta_campaign_id 
                      ? <span className="badge badge-success">OK</span>
                      : <span className="badge badge-danger">Brak</span>}
                  </td>
                  <td className="flex">
                    {!r.meta_campaign_id && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRetry(r.id)}>
                        Utwórz kampanię
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id, r.name)}>
                      Usuń
                    </button>
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
