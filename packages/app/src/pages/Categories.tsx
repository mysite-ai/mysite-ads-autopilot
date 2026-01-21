import { useEffect, useState } from 'react';
import { getAdSetCategories, updateAdSetCategory } from '../api';
import type { AdSetCategory, TargetingTemplate } from '../types';
import { RESTAURANT_INTERESTS } from '../types';

const DEFAULT_TARGETING: TargetingTemplate = {
  age_min: 18,
  age_max: 65,
  genders: [],
  interests: [],
};

export default function Categories() {
  const [categories, setCategories] = useState<AdSetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TargetingTemplate>(DEFAULT_TARGETING);

  const load = () => {
    setLoading(true);
    getAdSetCategories()
      .then(setCategories)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (cat: AdSetCategory) => {
    setEditingId(cat.id);
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

  if (loading) return <div className="loading">Ładowanie...</div>;

  return (
    <div>
      <h1>Kategorie (szablony targetowania)</h1>

      {/* CONTEXT */}
      <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 13, color: '#666' }}>
        <strong>Co to jest:</strong> Kategorie to szablony targetowania dla Ad Setów. LLM kategoryzuje post do jednej z kategorii (np. LU_ONS = Lunch na miejscu).
        <br/><strong>Jak działa:</strong> Gdy system tworzy Ad Set, bierze targetowanie (wiek, płeć, zainteresowania) z szablonu kategorii.
        <br/><strong>Przykład:</strong> Post o lunchu → LLM: "LU_ONS" → Ad Set z targetowaniem z szablonu LU_ONS.
      </div>

      <div className="card">
        <h2>Szablony ({categories.length})</h2>
        
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Nazwa</th>
              <th>Typ oferty</th>
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
                  <td><code style={{ fontWeight: 'bold' }}>{cat.code}</code></td>
                  <td>{cat.name}</td>
                  <td><span className="badge">{cat.offer_type}</span></td>
                  
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

      {/* LLM CATEGORIES EXPLANATION */}
      <div className="card" style={{ background: '#fefce8', border: '1px solid #fde047' }}>
        <h2>Jak LLM kategoryzuje posty?</h2>
        <div style={{ fontSize: 13 }}>
          <p style={{ marginBottom: 10 }}>LLM (Claude 3 Haiku) analizuje treść posta i przypisuje kategorię:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12 }}>
            <div><code>EV_*</code> - Wydarzenia (dla wszystkich/rodzin/par/seniorów)</div>
            <div><code>LU_ONS</code> - Lunch na miejscu</div>
            <div><code>LU_DEL</code> - Lunch delivery</div>
            <div><code>PR_ONS_*</code> - Promocja na miejscu (cykliczna/jednorazowa)</div>
            <div><code>PR_DEL_*</code> - Promocja delivery (cykliczna/jednorazowa)</div>
            <div><code>PD_ONS</code> - Produkt na miejscu</div>
            <div><code>PD_DEL</code> - Produkt delivery</div>
            <div><code>BRAND</code> - Post brandowy</div>
            <div><code>INFO</code> - Informacja</div>
          </div>
        </div>
      </div>
    </div>
  );
}
