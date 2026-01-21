import { useEffect, useState } from 'react';
import { getRestaurants, createRestaurant, deleteRestaurant, retryCampaignCreation } from '../api';
import type { Restaurant } from '../types';

// Generate code from name (first 3 letters uppercase)
const generateCode = (name: string): string => {
  return name
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase() || 'XXX';
};

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{
    name: string; website: string;
    area: 'S-CITY' | 'M-CITY' | 'L-CITY';
    fame: 'Neutral' | 'Hot' | 'Epic';
    delivery_radius_km: number;
    facebook_page_id: string; instagram_account_id: string;
    lat: number; lng: number; address: string;
  }>({
    name: '', website: '',
    area: 'M-CITY',
    fame: 'Neutral',
    delivery_radius_km: 5,
    facebook_page_id: '', instagram_account_id: '',
    lat: 52.2297, lng: 21.0122, address: 'Warszawa'
  });

  const load = () => {
    setLoading(true);
    getRestaurants().then(setRestaurants).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRestaurant({
      name: form.name,
      code: generateCode(form.name) + Date.now().toString().slice(-3), // Auto-generate unique code
      website: form.website,
      area: form.area,
      fame: form.fame,
      delivery_radius_km: form.delivery_radius_km,
      facebook_page_id: form.facebook_page_id,
      instagram_account_id: form.instagram_account_id || null,
      location: { lat: form.lat, lng: form.lng, address: form.address },
      budget_priorities: { Event: 20, Lunch: 20, Promo: 20, Product: 20, Brand: 10, Info: 10 }
    });
    setShowForm(false);
    setForm({ name: '', website: '', area: 'M-CITY' as const, fame: 'Neutral' as const, delivery_radius_km: 5, facebook_page_id: '', instagram_account_id: '', lat: 52.2297, lng: 21.0122, address: 'Warszawa' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Usunąć restaurację?')) {
      await deleteRestaurant(id);
      load();
    }
  };

  const handleRetry = async (id: string) => {
    await retryCampaignCreation(id);
    load();
  };

  if (loading) return <div className="loading">Ładowanie...</div>;

  return (
    <div>
      <div className="flex-between">
        <h1>Restauracje</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Anuluj' : '+ Dodaj'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Nowa restauracja</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label>Nazwa</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input value={form.website} onChange={e => setForm({...form, website: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Facebook Page ID</label>
                <input value={form.facebook_page_id} onChange={e => setForm({...form, facebook_page_id: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Instagram Account ID</label>
                <input 
                  value={form.instagram_account_id} 
                  onChange={e => setForm({...form, instagram_account_id: e.target.value})} 
                  placeholder="Zostaw puste jeśli brak IG"
                />
              </div>
              <div className="form-group">
                <label>Region</label>
                <select value={form.area} onChange={e => setForm({...form, area: e.target.value as 'S-CITY' | 'M-CITY' | 'L-CITY'})}>
                  <option value="S-CITY">Małe miasto</option>
                  <option value="M-CITY">Średnie miasto</option>
                  <option value="L-CITY">Duże miasto</option>
                </select>
              </div>
              <div className="form-group">
                <label>Radius delivery (km)</label>
                <input type="number" value={form.delivery_radius_km} onChange={e => setForm({...form, delivery_radius_km: +e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Zapisz</button>
          </form>
        </div>
      )}

      <div className="card">
        {restaurants.length === 0 ? (
          <p className="empty">Brak restauracji</p>
        ) : (
          <table>
            <thead>
              <tr><th>RID</th><th>Nazwa</th><th>Slug</th><th>Region</th><th>IG</th><th>Kampania Meta</th><th>Akcje</th></tr>
            </thead>
            <tbody>
              {restaurants.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.rid}</strong></td>
                  <td>{r.name}</td>
                  <td><code>{r.slug || '-'}</code></td>
                  <td>{r.area}</td>
                  <td>
                    {r.instagram_account_id 
                      ? <span className="badge badge-success">✓</span>
                      : <span className="badge badge-warning">-</span>}
                  </td>
                  <td>
                    {r.meta_campaign_id 
                      ? <span className="badge badge-success">{r.rid}-{r.slug}</span>
                      : <span className="badge badge-danger">Brak</span>}
                  </td>
                  <td className="flex">
                    {!r.meta_campaign_id && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRetry(r.id)}>Ponów</button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Usuń</button>
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
