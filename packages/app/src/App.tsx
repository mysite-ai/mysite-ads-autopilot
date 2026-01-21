import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Restaurants from './pages/Restaurants';
import Opportunities from './pages/Opportunities';
import AdSetConfig from './pages/AdSetConfig';
import Categories from './pages/Categories';
import PostsLog from './pages/PostsLog';
import Events from './pages/Events';
import LinkGenerator from './pages/LinkGenerator';

type Page = 'dashboard' | 'restaurants' | 'opportunities' | 'adsets' | 'events' | 'posts' | 'links' | 'categories';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">Meta Autopilot</div>
        <nav>
          {/* OVERVIEW */}
          <div className="nav-group">
            <div className="nav-group-title">Przegląd</div>
            <a href="#" className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>
              Dashboard
            </a>
          </div>

          {/* GŁÓWNE DANE - w kolejności tworzenia */}
          <div className="nav-group">
            <div className="nav-group-title">Dane</div>
            <a href="#" className={page === 'restaurants' ? 'active' : ''} onClick={() => setPage('restaurants')}>
              1. Restauracje
            </a>
            <a href="#" className={page === 'opportunities' ? 'active' : ''} onClick={() => setPage('opportunities')}>
              2. Okazje (PK)
            </a>
            <a href="#" className={page === 'adsets' ? 'active' : ''} onClick={() => setPage('adsets')}>
              3. Ad Sety
            </a>
            <a href="#" className={page === 'posts' ? 'active' : ''} onClick={() => setPage('posts')}>
              4. Reklamy
            </a>
          </div>

          {/* USTAWIENIA */}
          <div className="nav-group">
            <div className="nav-group-title">Ustawienia</div>
            <a href="#" className={page === 'categories' ? 'active' : ''} onClick={() => setPage('categories')}>
              Kategorie (szablony)
            </a>
            <a href="#" className={page === 'events' ? 'active' : ''} onClick={() => setPage('events')}>
              Wydarzenia
            </a>
          </div>

          {/* NARZĘDZIA */}
          <div className="nav-group">
            <div className="nav-group-title">Narzędzia</div>
            <a href="#" className={page === 'links' ? 'active' : ''} onClick={() => setPage('links')}>
              Generator linków
            </a>
          </div>
        </nav>
      </aside>
      <main>
        {page === 'dashboard' && <Dashboard />}
        {page === 'restaurants' && <Restaurants />}
        {page === 'opportunities' && <Opportunities />}
        {page === 'adsets' && <AdSetConfig />}
        {page === 'categories' && <Categories />}
        {page === 'events' && <Events />}
        {page === 'posts' && <PostsLog />}
        {page === 'links' && <LinkGenerator />}
      </main>
    </div>
  );
}
