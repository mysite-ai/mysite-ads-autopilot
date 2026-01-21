import { useEffect, useState } from 'react';
import { getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant, retryCampaignCreation } from '../api';
import type { Restaurant } from '../types';

const emptyForm = {
  name: '',
  website: '',
  facebook_page_id: '',
  instagram_account_id: '',
  area: 'M-CITY' as 'S-CITY' | 'M-CITY' | 'L-CITY',
  delivery_radius_km: 5,
  lat: '',
  lng: '',
  address: '',
};

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    getRestaurants().then(setRestaurants).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      alert('Podaj prawidłowe współrzędne lokalizacji (lat, lng)');
      return;
    }
    
    const data = {
      name: form.name,
      website: form.website || undefined,
      facebook_page_id: form.facebook_page_id,
      instagram_account_id: form.instagram_account_id || null,
      area: form.area,
      delivery_radius_km: form.delivery_radius_km,
      location: { lat, lng, address: form.address },
    };

    if (editingId) {
      await updateRestaurant(editingId, data);
    } else {
      await createRestaurant(data);
    }
    
    closeForm();
    load();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (r: Restaurant) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      website: r.website || '',
      facebook_page_id: r.facebook_page_id,
      instagram_account_id: r.instagram_account_id || '',
      area: r.area,
      delivery_radius_km: r.delivery_radius_km,
      lat: r.location?.lat?.toString() || '',
      lng: r.location?.lng?.toString() || '',
      address: r.location?.address || '',
    });
    setShowForm(true);
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
        <button className="btn btn-primary" onClick={() => { 
          if (showForm) closeForm(); 
          else setShowForm(true); 
        }}>
          {showForm ? 'Anuluj' : '+ Dodaj'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingId ? 'Edytuj restaurację' : 'Nowa restauracja'}</h2>
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
            <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Lokalizacja (wymagane dla reklam)</h3>
            <div className="grid-3">
              <div className="form-group">
                <label>Latitude</label>
                <input 
                  type="text" 
                  value={form.lat} 
                  onChange={e => setForm({...form, lat: e.target.value})} 
                  placeholder="np. 52.2297"
                  required
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input 
                  type="text" 
                  value={form.lng} 
                  onChange={e => setForm({...form, lng: e.target.value})} 
                  placeholder="np. 21.0122"
                  required
                />
              </div>
              <div className="form-group">
                <label>Adres</label>
                <input 
                  value={form.address} 
                  onChange={e => setForm({...form, address: e.target.value})} 
                  placeholder="ul. Przykładowa 1, Warszawa"
                />
              </div>
            </div>
            <div className="flex" style={{ gap: '10px', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Zapisz zmiany' : 'Dodaj restaurację'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Anuluj
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {restaurants.length === 0 ? (
          <p className="empty">Brak restauracji</p>
        ) : (
          <table>
            <thead>
              <tr><th>RID</th><th>Nazwa</th><th>Slug</th><th>Lokalizacja</th><th>Region</th><th>IG</th><th>Kampania Meta</th><th>Akcje</th></tr>
            </thead>
            <tbody>
              {restaurants.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.rid}</strong></td>
                  <td>{r.name}</td>
                  <td><code>{r.slug || '-'}</code></td>
                  <td>
                    {r.location && r.location.lat && r.location.lng && !(r.location.lat === 0 && r.location.lng === 0)
                      ? <span className="badge badge-success" title={`${r.location.lat}, ${r.location.lng}`}>✓</span>
                      : <span className="badge badge-danger" title="Brak lokalizacji - wymagana do reklam">✗</span>}
                  </td>
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
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(r)}>Edytuj</button>
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
