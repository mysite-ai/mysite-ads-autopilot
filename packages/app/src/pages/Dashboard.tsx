import { useEffect, useState } from 'react';
import { getRestaurants, getPosts, getAdSets, getOpportunities } from '../api';
import type { Restaurant, Opportunity } from '../types';

export default function Dashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState({ posts: 0, adSets: 0, active: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [r, p, a, o] = await Promise.all([getRestaurants(), getPosts(), getAdSets(), getOpportunities()]);
      setRestaurants(r);
      setOpportunities(o);
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

  if (loading) return <div className="loading">Ładowanie...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* FLOW EXPLANATION */}
      <div className="card" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <h2 style={{ marginBottom: 10 }}>Jak działa system?</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
          <div style={{ padding: '8px 12px', background: '#dbeafe', borderRadius: 6 }}>
            <strong>1. Restauracja</strong>
            <div style={{ fontSize: 11, color: '#666' }}>RID + slug → Kampania Meta</div>
          </div>
          <span style={{ color: '#999' }}>→</span>
          <div style={{ padding: '8px 12px', background: '#dbeafe', borderRadius: 6 }}>
            <strong>2. Okazja (PK)</strong>
            <div style={{ fontSize: 11, color: '#666' }}>offer_type (lunch, promo, event...)</div>
          </div>
          <span style={{ color: '#999' }}>→</span>
          <div style={{ padding: '8px 12px', background: '#dbeafe', borderRadius: 6 }}>
            <strong>3. Ad Set</strong>
            <div style={{ fontSize: 11, color: '#666' }}>pk{'{PK}'}_{'{kategoria}'}_v{'{n}'}</div>
          </div>
          <span style={{ color: '#999' }}>→</span>
          <div style={{ padding: '8px 12px', background: '#dbeafe', borderRadius: 6 }}>
            <strong>4. Reklama</strong>
            <div style={{ fontSize: 11, color: '#666' }}>Post FB → LLM → Ad</div>
          </div>
        </div>
        <div style={{ marginTop: 15, fontSize: 12, color: '#666' }}>
          <strong>Flow:</strong> Dodajesz post FB → LLM kategoryzuje → system tworzy/znajduje Okazję (PK) → tworzy/znajduje Ad Set → tworzy reklamę z URL tracking params
        </div>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="stat">
          <div className="stat-value">{restaurants.length}</div>
          <div className="stat-label">Restauracji</div>
        </div>
        <div className="stat">
          <div className="stat-value">{opportunities.length}</div>
          <div className="stat-label">Okazji (PK)</div>
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

      {/* QUICK STATUS */}
      <div className="card">
        <h2>Status restauracji ({restaurants.length})</h2>
        {restaurants.length === 0 ? (
          <p className="empty">Brak restauracji. Dodaj pierwszą w zakładce "1. Restauracje".</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>RID</th>
                <th>Nazwa</th>
                <th>Kampania Meta</th>
                <th>Lokalizacja</th>
                <th>Okazje (PK)</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map(r => {
                const restoOpps = opportunities.filter(o => o.rid === r.rid);
                const hasLocation = r.location && r.location.lat && r.location.lng && !(r.location.lat === 0 && r.location.lng === 0);
                
                return (
                  <tr key={r.id}>
                    <td><strong>{r.rid}</strong></td>
                    <td>
                      {r.name}
                      <div style={{ fontSize: 11, color: '#666' }}>{r.slug}</div>
                    </td>
                    <td>
                      {r.meta_campaign_id 
                        ? <span className="badge badge-success">{r.rid}-{r.slug}</span>
                        : <span className="badge badge-danger">Brak kampanii!</span>}
                    </td>
                    <td>
                      {hasLocation
                        ? <span className="badge badge-success">OK</span>
                        : <span className="badge badge-danger">Brak!</span>}
                    </td>
                    <td>
                      {restoOpps.length > 0 ? (
                        <span title={restoOpps.map(o => `pk${o.pk}: ${o.name}`).join('\n')}>
                          {restoOpps.length} okazji
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>brak</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* TRACKING INFO */}
      <div className="card" style={{ background: '#fefce8', border: '1px solid #fde047' }}>
        <h2>Atrybucja (URL tracking)</h2>
        <div style={{ fontSize: 13 }}>
          <p style={{ marginBottom: 10 }}>Każda reklama ma parametry URL dla atrybucji:</p>
          <code style={{ display: 'block', padding: 10, background: '#fff', borderRadius: 4, fontSize: 12 }}>
            ?r={'{RID}'}&c=.pi1.pk{'{PK}'}.ps{'{{'+'ad.id}}'}&utm_source=mysite&utm_medium=meta&utm_campaign=pk{'{PK}'}-{'{slug}'}&utm_content={'{kategoria}'}-v{'{n}'}
          </code>
          <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
            <strong>r</strong> = Restaurant ID | 
            <strong> c</strong> = pi (platform) + pk (opportunity) + ps (ad id) | 
            <strong> utm_*</strong> = standard tracking
          </div>
        </div>
      </div>
    </div>
  );
}
