import { useEffect, useState } from 'react';
import { getAdSetCategories, getAdSets, getRestaurants, getOpportunities, deleteAdSet } from '../api';
import type { AdSetCategory, AdSet, Restaurant, Opportunity } from '../types';

export default function AdSetConfig() {
  const [categories, setCategories] = useState<AdSetCategory[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getAdSetCategories(), getAdSets(), getRestaurants(), getOpportunities()])
      .then(([c, a, r, o]) => { setCategories(c); setAdSets(a); setRestaurants(r); setOpportunities(o); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDeleteAdSet = async (id: string, name: string) => {
    if (!confirm(`Usunąć ad set "${name}" i wszystkie jego reklamy z Meta?`)) return;
    try {
      await deleteAdSet(id);
      load();
    } catch (e) {
      alert(`Błąd: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (loading) return <div className="loading">Ładowanie...</div>;

  const filtered = filter ? adSets.filter(a => a.restaurant_id === filter) : adSets;
  
  const getRestaurant = (id: string) => restaurants.find(r => r.id === id);
  const getOpportunity = (pk: number | null) => pk ? opportunities.find(o => o.pk === pk) : null;
  const getCategory = (id: string) => categories.find(c => c.id === id);

  return (
    <div>
      <h1>3. Ad Sety</h1>

      {/* CONTEXT */}
      <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 13, color: '#666' }}>
        <strong>Co to jest:</strong> Ad Set to "zestaw reklam" w Meta Ads z konkretnym targetowaniem (wiek, płeć, lokalizacja, zainteresowania).
        <br/><strong>Nazwa:</strong> <code>pk{'{PK}'}_{'{kategoria}'}_v{'{wersja}'}</code> - np. <code>pk5_LU_ONS_v1</code> = Okazja 5, Lunch na miejscu, wersja 1.
        <br/><strong>Skąd się bierze:</strong> System tworzy Ad Set automatycznie gdy dodajesz reklamę. Szablon kategorii (w Ustawieniach) określa targetowanie.
        <br/><strong>Powiązania:</strong> Ad Set należy do Restauracji + Okazji (PK) + Kategorii.
      </div>

      {/* Lista Ad Setów */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 15 }}>
          <h2>Aktywne Ad Sety ({filtered.length})</h2>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
            <option value="">Wszystkie</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="empty">Brak ad setów{filter ? ' dla wybranej restauracji' : ''}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Restauracja</th>
                <th>Opportunity (PK)</th>
                <th>Kategoria</th>
                <th>Ad Set Name</th>
                <th>Meta Ad Set ID</th>
                <th>Reklamy</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(as => {
                const restaurant = getRestaurant(as.restaurant_id);
                const opportunity = getOpportunity(as.pk);
                const category = getCategory(as.category_id);
                
                return (
                  <tr key={as.id}>
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
                            {opportunity.name}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>brak (legacy)</span>
                      )}
                    </td>
                    <td>
                      <code>{category?.code || as.category_id}</code>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        {category?.name}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: 12 }}>{as.name}</code>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        wersja {as.version}
                      </div>
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {as.meta_ad_set_id ? (
                        <code title={as.meta_ad_set_id}>...{as.meta_ad_set_id.slice(-10)}</code>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: as.ads_count >= 45 ? '#dc3545' : as.ads_count >= 30 ? '#ffc107' : 'inherit' }}>
                        {as.ads_count}/50
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${as.status === 'ACTIVE' ? 'success' : 'secondary'}`}>
                        {as.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAdSet(as.id, as.name)}>
                        Usuń
                      </button>
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
