import { useEffect, useState } from 'react';
import { getAdSetCategories, getAdSets, getRestaurants, getOpportunities, deleteAdSet, updateAdSetCategory } from '../api';
import type { AdSetCategory, AdSet, Restaurant, Opportunity, TargetingTemplate } from '../types';
import { RESTAURANT_INTERESTS } from '../types';

const DEFAULT_TARGETING: TargetingTemplate = {
  age_min: 18,
  age_max: 65,
  genders: [],
  interests: [],
};

export default function AdSetConfig() {
  const [categories, setCategories] = useState<AdSetCategory[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TargetingTemplate>(DEFAULT_TARGETING);

  const load = () => {
    setLoading(true);
    Promise.all([getAdSetCategories(), getAdSets(), getRestaurants(), getOpportunities()])
      .then(([c, a, r, o]) => { setCategories(c); setAdSets(a); setRestaurants(r); setOpportunities(o); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (cat: AdSetCategory) => {
    setEditingId(cat.id);
    // Upewnij się że wszystkie pola mają wartości domyślne
    const t = cat.targeting_template || {};
    setEditForm({
      age_min: t.age_min ?? 18,
      age_max: t.age_max ?? 65,
      genders: t.genders ?? [],
      interests: t.interests ?? [],
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await updateAdSetCategory(editingId, { 
        targeting_template: {
          age_min: editForm.age_min,
          age_max: editForm.age_max,
          genders: editForm.genders,
          interests: editForm.interests,
        } 
      });
      setEditingId(null);
      load();
    } catch (e) {
      alert(`Błąd: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(DEFAULT_TARGETING);
  };

  const toggleInterest = (interest: { id: string; name: string }) => {
    const exists = editForm.interests.some(i => i.id === interest.id);
    if (exists) {
      setEditForm({ ...editForm, interests: editForm.interests.filter(i => i.id !== interest.id) });
    } else {
      setEditForm({ ...editForm, interests: [...editForm.interests, interest] });
    }
  };

  const toggleGender = (gender: number) => {
    const exists = editForm.genders.includes(gender);
    if (exists) {
      setEditForm({ ...editForm, genders: editForm.genders.filter(g => g !== gender) });
    } else {
      setEditForm({ ...editForm, genders: [...editForm.genders, gender] });
    }
  };

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
        <br/><strong>Skąd się bierze:</strong> System tworzy Ad Set automatycznie gdy dodajesz reklamę. Szablon kategorii (LU_ONS, PR_DEL itd.) określa targetowanie.
        <br/><strong>Powiązania:</strong> Ad Set należy do Restauracji + Okazji (PK) + Kategorii.
      </div>

      {/* Kategorie z targetowaniem */}
      <div className="card">
        <h2>Szablony kategorii ({categories.length})</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>
          Kategorie to szablony targetowania. LLM kategoryzuje post → system używa odpowiedniego szablonu do stworzenia Ad Setu.
        </p>
        
        <table>
          <thead>
            <tr>
              <th>Kategoria</th>
              <th>Wiek</th>
              <th>Płeć</th>
              <th>Zainteresowania</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const raw = cat.targeting_template || {};
              const t = {
                age_min: raw.age_min ?? 18,
                age_max: raw.age_max ?? 65,
                genders: raw.genders ?? [],
                interests: raw.interests ?? [],
              };
              const isEditing = editingId === cat.id;
              
              return (
                <tr key={cat.id}>
                  <td>
                    <code>{cat.code}</code>
                    <div style={{ fontSize: 11, color: '#666' }}>{cat.name}</div>
                  </td>
                  
                  {isEditing ? (
                    <>
                      <td>
                        <div className="flex" style={{ gap: 5 }}>
                          <input 
                            type="number" 
                            value={editForm.age_min} 
                            onChange={e => setEditForm({ ...editForm, age_min: +e.target.value })}
                            style={{ width: 60 }}
                            min={18} max={65}
                          />
                          <span>-</span>
                          <input 
                            type="number" 
                            value={editForm.age_max}
                            onChange={e => setEditForm({ ...editForm, age_max: +e.target.value })}
                            style={{ width: 60 }}
                            min={18} max={65}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="flex" style={{ gap: 5, flexWrap: 'wrap' }}>
                          <label className="checkbox-label">
                            <input type="checkbox" checked={editForm.genders.includes(1)} onChange={() => toggleGender(1)} />
                            M
                          </label>
                          <label className="checkbox-label">
                            <input type="checkbox" checked={editForm.genders.includes(2)} onChange={() => toggleGender(2)} />
                            K
                          </label>
                        </div>
                        <div style={{ fontSize: 10, color: '#999' }}>puste = wszyscy</div>
                      </td>
                      <td>
                        <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: 12 }}>
                          {RESTAURANT_INTERESTS.map(int => (
                            <label key={int.id} className="checkbox-label" style={{ display: 'block', marginBottom: 3 }}>
                              <input 
                                type="checkbox" 
                                checked={editForm.interests.some(i => i.id === int.id)}
                                onChange={() => toggleInterest(int)}
                              />
                              {int.name}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="flex">
                          <button className="btn btn-primary btn-sm" onClick={handleSave}>Zapisz</button>
                          <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Anuluj</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{t.age_min} - {t.age_max}</td>
                      <td>
                        {t.genders.length === 0 ? 'Wszyscy' : 
                          t.genders.map(g => g === 1 ? 'M' : 'K').join(', ')}
                      </td>
                      <td>
                        {t.interests.length === 0 ? (
                          <span style={{ color: '#999' }}>Brak</span>
                        ) : (
                          <span title={t.interests.map(i => i.name).join(', ')}>
                            {t.interests.length} zainteresowań
                          </span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(cat)}>
                          Edytuj
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
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
