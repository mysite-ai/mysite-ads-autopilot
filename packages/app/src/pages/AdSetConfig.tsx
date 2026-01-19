import { useEffect, useState } from 'react';
import { getAdSetCategories, updateAdSetCategory, getAdSets } from '../api';
import type { AdSetCategory, AdSet } from '../types';

export default function AdSetConfig() {
  const [categories, setCategories] = useState<AdSetCategory[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdSetCategory>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesData, adSetsData] = await Promise.all([
        getAdSetCategories(),
        getAdSets(),
      ]);
      setCategories(categoriesData);
      setAdSets(adSetsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (category: AdSetCategory) => {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      requires_delivery: category.requires_delivery,
      targeting_template: category.targeting_template,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    
    setSaving(true);
    try {
      await updateAdSetCategory(editingId, editForm);
      setToast({ type: 'success', message: 'Kategoria zaktualizowana' });
      setEditingId(null);
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: `Błąd: ${err}` });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const getAdSetCount = (categoryId: string) => {
    return adSets.filter((as) => as.category_id === categoryId).length;
  };

  const getTotalAdsCount = (categoryId: string) => {
    return adSets
      .filter((as) => as.category_id === categoryId)
      .reduce((sum, as) => sum + as.ads_count, 0);
  };

  // Group categories by parent
  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.parent_category]) {
      acc[cat.parent_category] = [];
    }
    acc[cat.parent_category].push(cat);
    return acc;
  }, {} as Record<string, AdSetCategory[]>);

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
        <h1 className="page-title">Konfiguracja Ad Sets</h1>
        <p className="page-subtitle">Zarządzaj kategoriami i ustawieniami grup reklam</p>
      </div>

      {Object.entries(groupedCategories).map(([parent, cats]) => (
        <div key={parent} className="card">
          <div className="card-header">
            <h2 className="card-title">{parent}</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Nazwa</th>
                  <th>Delivery</th>
                  <th>Event</th>
                  <th>Ad Sets</th>
                  <th>Reklamy</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cats.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                        {cat.code}
                      </span>
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          style={{ padding: '6px 10px' }}
                        />
                      ) : (
                        cat.name
                      )}
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <select
                          className="form-select"
                          value={editForm.requires_delivery ? 'true' : 'false'}
                          onChange={(e) => setEditForm({ ...editForm, requires_delivery: e.target.value === 'true' })}
                          style={{ padding: '6px 10px', width: 80 }}
                        >
                          <option value="true">Tak</option>
                          <option value="false">Nie</option>
                        </select>
                      ) : (
                        <span className={`badge ${cat.requires_delivery ? 'badge-success' : 'badge-neutral'}`}>
                          {cat.requires_delivery ? 'Tak' : 'Nie'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${cat.is_event_type ? 'badge-warning' : 'badge-neutral'}`}>
                        {cat.is_event_type ? 'Tak' : 'Nie'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{getAdSetCount(cat.id)}</td>
                    <td style={{ fontWeight: 600 }}>{getTotalAdsCount(cat.id)}</td>
                    <td>
                      {editingId === cat.id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-primary btn-small"
                            onClick={saveEdit}
                            disabled={saving}
                          >
                            {saving ? '...' : 'Zapisz'}
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={cancelEdit}
                          >
                            Anuluj
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => startEdit(cat)}
                        >
                          Edytuj
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Aktywne Ad Sets</h2>
        </div>
        {adSets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <p>Brak ad setów. Zostaną utworzone automatycznie przy pierwszych postach.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Wersja</th>
                  <th>Reklamy</th>
                  <th>Status</th>
                  <th>Event</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {adSets.slice(0, 20).map((adSet) => (
                  <tr key={adSet.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{adSet.name}</td>
                    <td>v{adSet.version}</td>
                    <td>
                      <span style={{ 
                        color: adSet.ads_count >= 45 ? 'var(--warning)' : 
                               adSet.ads_count >= 50 ? 'var(--danger)' : 'inherit' 
                      }}>
                        {adSet.ads_count}/50
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${adSet.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                        {adSet.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {adSet.event_identifier || '-'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(adSet.created_at).toLocaleDateString('pl')}
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
