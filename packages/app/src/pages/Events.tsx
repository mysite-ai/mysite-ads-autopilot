import { useEffect, useState } from 'react';
import { getEvents, getRestaurants, getAdSets, getPosts } from '../api';
import type { Event, Restaurant, AdSet, Post } from '../types';

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getEvents(), getRestaurants(), getAdSets(), getPosts()])
      .then(([e, r, a, p]) => { 
        setEvents(e); 
        setRestaurants(r); 
        setAdSets(a);
        setPosts(p);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading">Ładowanie...</div>;

  const filtered = filter ? events.filter(e => e.restaurant_id === filter) : events;
  const getRestaurantName = (id: string) => restaurants.find(r => r.id === id)?.name || 'Nieznana';
  const getAdSetName = (id: string) => adSets.find(a => a.id === id)?.name || '-';
  const getPostsForAdSet = (adSetId: string) => posts.filter(p => p.ad_set_id === adSetId);

  // Grupuj eventy nadchodzące vs przeszłe
  const today = new Date().toISOString().split('T')[0];
  const upcoming = filtered.filter(e => e.event_date >= today);
  const past = filtered.filter(e => e.event_date < today);

  return (
    <div>
      <h1>Wydarzenia ({events.length})</h1>

      <div className="card" style={{ marginBottom: 20, padding: 15, background: '#f8f9fa' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
          <strong>Jak działają eventy:</strong> Każde unikalne wydarzenie (np. "walentynki-2026") ma własny Ad Set.
          Wszystkie posty o tym samym wydarzeniu trafiają do tego samego Ad Setu.
          LLM automatycznie rozpoznaje eventy i przypisuje im identyfikator.
        </p>
      </div>

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 15 }}>
          <h2>Nadchodzące wydarzenia ({upcoming.length})</h2>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
            <option value="">Wszystkie</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {upcoming.length === 0 ? (
          <p className="empty">Brak nadchodzących wydarzeń</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Restauracja</th>
                <th>Wydarzenie</th>
                <th>Data</th>
                <th>Ad Set</th>
                <th>Reklamy</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map(event => {
                const eventPosts = getPostsForAdSet(event.ad_set_id);
                return (
                  <tr key={event.id}>
                    <td>{getRestaurantName(event.restaurant_id)}</td>
                    <td>
                      <strong>{event.name}</strong>
                      <div style={{ fontSize: 11, color: '#666' }}>{event.identifier}</div>
                    </td>
                    <td>
                      <span style={{ 
                        color: new Date(event.event_date) <= new Date(Date.now() + 7*24*60*60*1000) ? '#dc3545' : 'inherit',
                        fontWeight: new Date(event.event_date) <= new Date(Date.now() + 7*24*60*60*1000) ? 600 : 400
                      }}>
                        {event.event_date}
                      </span>
                    </td>
                    <td><code>{getAdSetName(event.ad_set_id)}</code></td>
                    <td>
                      {eventPosts.length === 0 ? (
                        <span style={{ color: '#999' }}>0</span>
                      ) : (
                        <span className="badge badge-success">{eventPosts.length} reklam</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {past.length > 0 && (
        <div className="card">
          <h2>Przeszłe wydarzenia ({past.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Restauracja</th>
                <th>Wydarzenie</th>
                <th>Data</th>
                <th>Ad Set</th>
                <th>Reklamy</th>
              </tr>
            </thead>
            <tbody>
              {past.map(event => {
                const eventPosts = getPostsForAdSet(event.ad_set_id);
                return (
                  <tr key={event.id} style={{ opacity: 0.6 }}>
                    <td>{getRestaurantName(event.restaurant_id)}</td>
                    <td>
                      <strong>{event.name}</strong>
                      <div style={{ fontSize: 11, color: '#666' }}>{event.identifier}</div>
                    </td>
                    <td>{event.event_date}</td>
                    <td><code>{getAdSetName(event.ad_set_id)}</code></td>
                    <td>{eventPosts.length} reklam</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
