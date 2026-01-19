import { useEffect, useState } from 'react';
import { getRestaurants, createRestaurant, updateRestaurant } from '../api';
import type { Restaurant, CreateRestaurantDto } from '../types';

const DEFAULT_BUDGET: Record<string, number> = {
  Event: 20,
  Lunch: 20,
  Promo: 25,
  Product: 15,
  Brand: 10,
  Info: 10,
};

const EMPTY_RESTAURANT: CreateRestaurantDto = {
  name: '',
  code: '',
  website: '',
  area: 'M-CITY',
  fame: 'Neutral',
  delivery_radius_km: 5,
  budget_priorities: DEFAULT_BUDGET,
  facebook_page_id: '',
  instagram_account_id: '',
  location: { lat: 0, lng: 0, address: '' },
};

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateRestaurantDto>(EMPTY_RESTAURANT);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      const data = await getRestaurants();
      setRestaurants(data);
    } catch (err) {
      console.error('Failed to load restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_RESTAURANT);
    setShowModal(true);
  };

  const openEdit = (restaurant: Restaurant) => {
    setEditingId(restaurant.id);
    setForm({
      name: restaurant.name,
      code: restaurant.code,
      website: restaurant.website,
      area: restaurant.area,
      fame: restaurant.fame,
      delivery_radius_km: restaurant.delivery_radius_km,
      budget_priorities: restaurant.budget_priorities,
      facebook_page_id: restaurant.facebook_page_id,
      instagram_account_id: restaurant.instagram_account_id,
      location: restaurant.location,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await updateRestaurant(editingId, form);
        setToast({ type: 'success', message: 'Restauracja zaktualizowana' });
      } else {
        await createRestaurant(form);
        setToast({ type: 'success', message: 'Restauracja dodana' });
      }
      setShowModal(false);
      loadRestaurants();
    } catch (err) {
      setToast({ type: 'error', message: `Błąd: ${err}` });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const updateField = <K extends keyof CreateRestaurantDto>(key: K, value: CreateRestaurantDto[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateBudget = (category: string, value: number) => {
    setForm((prev) => ({
      ...prev,
      budget_priorities: { ...prev.budget_priorities, [category]: value },
    }));
  };

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
        <h1 className="page-title">Restauracje</h1>
        <p className="page-subtitle">Zarządzaj kampaniami restauracji</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Lista restauracji</h2>
          <button className="btn btn-primary" onClick={openNew}>
            + Dodaj restaurację
          </button>
        </div>

        {restaurants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🍽️</div>
            <p>Brak restauracji. Dodaj pierwszą restaurację, aby rozpocząć.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Kod</th>
                  <th>Miasto</th>
                  <th>Fame</th>
                  <th>Page ID</th>
                  <th>Kampania</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>
                      <span className="badge badge-neutral">{r.code}</span>
                    </td>
                    <td>{r.area}</td>
                    <td>
                      <span className={`badge ${
                        r.fame === 'Epic' ? 'badge-success' :
                        r.fame === 'Hot' ? 'badge-warning' : 'badge-neutral'
                      }`}>
                        {r.fame}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {r.facebook_page_id}
                    </td>
                    <td>
                      {r.meta_campaign_id ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-warning">Pending</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => openEdit(r)}
                      >
                        Edytuj
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingId ? 'Edytuj restaurację' : 'Nowa restauracja'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nazwa restauracji</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Bistro Flane"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kod (2-4 litery)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.code}
                      onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                      placeholder="BF"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Website</label>
                  <input
                    type="url"
                    className="form-input"
                    value={form.website}
                    onChange={(e) => updateField('website', e.target.value)}
                    placeholder="https://bistroflane.pl"
                  />
                </div>

                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label className="form-label">Wielkość miasta</label>
                    <select
                      className="form-select"
                      value={form.area}
                      onChange={(e) => updateField('area', e.target.value as 'S-CITY' | 'M-CITY' | 'L-CITY')}
                    >
                      <option value="S-CITY">S-CITY (małe)</option>
                      <option value="M-CITY">M-CITY (średnie)</option>
                      <option value="L-CITY">L-CITY (duże)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fame</label>
                    <select
                      className="form-select"
                      value={form.fame}
                      onChange={(e) => updateField('fame', e.target.value as 'Neutral' | 'Hot' | 'Epic')}
                    >
                      <option value="Neutral">Neutral</option>
                      <option value="Hot">Hot</option>
                      <option value="Epic">Epic</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Delivery radius (km)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.delivery_radius_km}
                      onChange={(e) => updateField('delivery_radius_km', parseInt(e.target.value) || 5)}
                      min={1}
                      max={50}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Facebook Page ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.facebook_page_id}
                      onChange={(e) => updateField('facebook_page_id', e.target.value)}
                      placeholder="123456789012345"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Instagram Account ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.instagram_account_id}
                      onChange={(e) => updateField('instagram_account_id', e.target.value)}
                      placeholder="17841400000000000"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Adres</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.location.address}
                    onChange={(e) => updateField('location', { ...form.location, address: e.target.value })}
                    placeholder="ul. Przykładowa 1, 00-001 Warszawa"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={form.location.lat || ''}
                      onChange={(e) => updateField('location', { ...form.location, lat: parseFloat(e.target.value) || 0 })}
                      placeholder="52.2297"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={form.location.lng || ''}
                      onChange={(e) => updateField('location', { ...form.location, lng: parseFloat(e.target.value) || 0 })}
                      placeholder="21.0122"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Priorytety budżetowe (%)</label>
                  <div className="grid grid-3" style={{ gap: 12 }}>
                    {Object.entries(form.budget_priorities).map(([category, value]) => (
                      <div key={category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {category}
                        </span>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: 70, padding: '8px 12px' }}
                          value={value}
                          onChange={(e) => updateBudget(category, parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Anuluj
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Zapisywanie...' : editingId ? 'Zapisz zmiany' : 'Dodaj restaurację'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
