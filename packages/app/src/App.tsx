import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Restaurants from './pages/Restaurants';
import Opportunities from './pages/Opportunities';
import AdSetConfig from './pages/AdSetConfig';
import PostsLog from './pages/PostsLog';
import Events from './pages/Events';
import LinkGenerator from './pages/LinkGenerator';

type Page = 'dashboard' | 'restaurants' | 'opportunities' | 'adsets' | 'events' | 'posts' | 'links';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">Meta Autopilot</div>
        <nav>
          <a href="#" className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>
            Dashboard
          </a>
          <a href="#" className={page === 'restaurants' ? 'active' : ''} onClick={() => setPage('restaurants')}>
            Restauracje
          </a>
          <a href="#" className={page === 'opportunities' ? 'active' : ''} onClick={() => setPage('opportunities')}>
            Opportunities
          </a>
          <a href="#" className={page === 'adsets' ? 'active' : ''} onClick={() => setPage('adsets')}>
            Ad Sety
          </a>
          <a href="#" className={page === 'posts' ? 'active' : ''} onClick={() => setPage('posts')}>
            Reklamy
          </a>
          <a href="#" className={page === 'links' ? 'active' : ''} onClick={() => setPage('links')}>
            Link Generator
          </a>
          <a href="#" className={page === 'events' ? 'active' : ''} onClick={() => setPage('events')}>
            Wydarzenia
          </a>
        </nav>
      </aside>
      <main>
        {page === 'dashboard' && <Dashboard />}
        {page === 'restaurants' && <Restaurants />}
        {page === 'opportunities' && <Opportunities />}
        {page === 'adsets' && <AdSetConfig />}
        {page === 'events' && <Events />}
        {page === 'posts' && <PostsLog />}
        {page === 'links' && <LinkGenerator />}
      </main>
    </div>
  );
}
