import { useState, useEffect } from 'react';
import { 
  getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
  getRestaurants, getAdSets, getPosts
} from '../api';
import type { Opportunity, Restaurant, AdSet, Post, OfferType, OpportunityStatus, OpportunityGoal } from '../types';

const OFFER_TYPES: { value: OfferType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'promo', label: 'Promo' },
  { value: 'product', label: 'Product' },
  { value: 'brand', label: 'Brand' },
  { value: 'info', label: 'Info' },
];

const GOALS: { value: OpportunityGoal; label: string }[] = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'leads', label: 'Leads' },
  { value: 'orders', label: 'Orders' },
  { value: 'awareness', label: 'Awareness' },
];

const STATUSES: { value: OpportunityStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: '#6b7280' },
  { value: 'active', label: 'Active', color: '#10b981' },
  { value: 'paused', label: 'Paused', color: '#f59e0b' },
  { value: 'completed', label: 'Completed', color: '#3b82f6' },
];

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filterRid, setFilterRid] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<OpportunityStatus | ''>('');
  const [filterOfferType, setFilterOfferType] = useState<OfferType | ''>('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    rid: 0,
    name: '',
    slug: '',
    goal: 'traffic' as OpportunityGoal,
    offer_type: 'promo' as OfferType,
    start_date: '',
    end_date: '',
    status: 'active' as OpportunityStatus,
  });

  useEffect(() => {
    loadData();
  }, [filterRid]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [opps, rests, sets, psts] = await Promise.all([
        getOpportunities(filterRid || undefined),
        getRestaurants(),
        getAdSets(),
        getPosts(),
      ]);
      setOpportunities(opps);
      setRestaurants(rests);
      setAdSets(sets);
      setPosts(psts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filteredOpportunities = opportunities.filter(opp => {
    if (filterStatus && opp.status !== filterStatus) return false;
    if (filterOfferType && opp.offer_type !== filterOfferType) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateOpportunity(editingId, {
          name: formData.name,
          slug: formData.slug || undefined,
          goal: formData.goal,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
        });
      } else {
        await createOpportunity({
          rid: formData.rid,
          name: formData.name,
          slug: formData.slug || '',
          goal: formData.goal,
          offer_type: formData.offer_type,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
          metadata: {},
        });
      }
      resetForm();
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save opportunity');
    }
  };

  const handleEdit = (opp: Opportunity) => {
    setEditingId(opp.id);
    setFormData({
      rid: opp.rid,
      name: opp.name,
      slug: opp.slug,
      goal: opp.goal,
      offer_type: opp.offer_type,
      start_date: opp.start_date || '',
      end_date: opp.end_date || '',
      status: opp.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this opportunity?')) return;
    try {
      await deleteOpportunity(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete opportunity');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      rid: restaurants[0]?.rid || 0,
      name: '',
      slug: '',
      goal: 'traffic',
      offer_type: 'promo',
      start_date: '',
      end_date: '',
      status: 'active',
    });
  };

  const getRestaurant = (rid: number) => restaurants.find(r => r.rid === rid);
  
  const getLinkedAdSets = (pk: number) => adSets.filter(a => a.pk === pk);
  const getLinkedPosts = (pk: number) => posts.filter(p => p.pk === pk);

  const getStatusColor = (status: OpportunityStatus) => {
    return STATUSES.find(s => s.value === status)?.color || '#6b7280';
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>2. Okazje marketingowe (PK)</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nowa okazja
        </button>
      </div>

      {/* CONTEXT */}
      <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 13, color: '#666' }}>
        <strong>Co to jest:</strong> Okazja (Opportunity) to "kampania marketingowa" dla restauracji - np. promocja walentynkowa, lunch deal, koncert.
        Każda okazja ma unikalny <strong>PK</strong> (Opportunity Key) używany do atrybucji.
        <br/><strong>Skąd się bierze:</strong> System tworzy okazje automatycznie gdy LLM kategoryzuje post (np. post o lunchu → okazja typu "lunch").
        Możesz też tworzyć ręcznie.
        <br/><strong>Powiązania:</strong> Okazja → wiele Ad Setów → wiele Reklam. Ten sam PK łączy wszystkie elementy.
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="filters">
        <select 
          value={filterRid || ''} 
          onChange={e => setFilterRid(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">All Restaurants</option>
          {restaurants.map(r => (
            <option key={r.id} value={r.rid}>{r.name} (rid={r.rid})</option>
          ))}
        </select>

        <select 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value as OpportunityStatus | '')}
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select 
          value={filterOfferType} 
          onChange={e => setFilterOfferType(e.target.value as OfferType | '')}
        >
          <option value="">All Types</option>
          {OFFER_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => resetForm()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingId ? 'Edit Opportunity' : 'New Opportunity'}</h2>
            <form onSubmit={handleSubmit}>
              {!editingId && (
                <div className="form-group">
                  <label>Restaurant</label>
                  <select
                    value={formData.rid}
                    onChange={e => setFormData({ ...formData, rid: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Select restaurant...</option>
                    {restaurants.map(r => (
                      <option key={r.id} value={r.rid}>{r.name} (rid={r.rid})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lunch Promo January"
                  required
                />
              </div>

              <div className="form-group">
                <label>Slug (optional, auto-generated)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., lunch-promo-january"
                />
              </div>

              {!editingId && (
                <div className="form-group">
                  <label>Offer Type</label>
                  <select
                    value={formData.offer_type}
                    onChange={e => setFormData({ ...formData, offer_type: e.target.value as OfferType })}
                    required
                  >
                    {OFFER_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Goal</label>
                <select
                  value={formData.goal}
                  onChange={e => setFormData({ ...formData, goal: e.target.value as OpportunityGoal })}
                >
                  {GOALS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as OpportunityStatus })}
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>PK</th>
            <th>Restaurant</th>
            <th>Name</th>
            <th>Type</th>
            <th>Goal</th>
            <th>Linked Ad Sets</th>
            <th>Linked Posts</th>
            <th>Status</th>
            <th>Dates</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredOpportunities.map(opp => {
            const restaurant = getRestaurant(opp.rid);
            const linkedAdSets = getLinkedAdSets(opp.pk);
            const linkedPosts = getLinkedPosts(opp.pk);
            
            return (
              <tr key={opp.id}>
                <td><strong style={{ color: '#2563eb' }}>pk{opp.pk}</strong></td>
                <td>
                  <strong>{restaurant?.name || `RID: ${opp.rid}`}</strong>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    rid={opp.rid} / {restaurant?.slug || '-'}
                  </div>
                </td>
                <td>
                  {opp.name}
                  <div style={{ fontSize: 11, color: '#666' }}>
                    slug: {opp.slug}
                  </div>
                </td>
                <td>
                  <span className="badge">{opp.offer_type}</span>
                </td>
                <td>{opp.goal}</td>
                <td>
                  <strong>{linkedAdSets.length}</strong>
                  {linkedAdSets.length > 0 && (
                    <div style={{ fontSize: 10, color: '#666' }}>
                      {linkedAdSets.map(a => a.name).join(', ').slice(0, 30)}...
                    </div>
                  )}
                </td>
                <td>
                  <strong>{linkedPosts.length}</strong>
                  {linkedPosts.length > 0 && (
                    <div style={{ fontSize: 10, color: '#666' }}>
                      {linkedPosts.filter(p => p.status === 'ACTIVE').length} active
                    </div>
                  )}
                </td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(opp.status) }}
                  >
                    {opp.status}
                  </span>
                </td>
                <td>
                  {opp.start_date && <span>{opp.start_date}</span>}
                  {opp.start_date && opp.end_date && <span> - </span>}
                  {opp.end_date && <span>{opp.end_date}</span>}
                  {!opp.start_date && !opp.end_date && <span className="text-muted">-</span>}
                </td>
                <td>
                  <button className="btn btn-sm" onClick={() => handleEdit(opp)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(opp.id)}>Delete</button>
                </td>
              </tr>
            );
          })}
          {filteredOpportunities.length === 0 && (
            <tr>
              <td colSpan={10} className="text-center">No opportunities found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
