import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Restaurants from './pages/Restaurants';
import AdSetConfig from './pages/AdSetConfig';
import PostsLog from './pages/PostsLog';

type Page = 'dashboard' | 'restaurants' | 'adsets' | 'posts';

function App() {
  const [page, setPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'restaurants': return <Restaurants />;
      case 'adsets': return <AdSetConfig />;
      case 'posts': return <PostsLog />;
    }
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <span>⚡</span> Autopilot
        </div>
        <a
          href="#"
          className={`nav-link ${page === 'dashboard' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); setPage('dashboard'); }}
        >
          📊 Dashboard
        </a>
        <a
          href="#"
          className={`nav-link ${page === 'restaurants' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); setPage('restaurants'); }}
        >
          🍽️ Restauracje
        </a>
        <a
          href="#"
          className={`nav-link ${page === 'adsets' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); setPage('adsets'); }}
        >
          🎯 Ad Sets
        </a>
        <a
          href="#"
          className={`nav-link ${page === 'posts' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); setPage('posts'); }}
        >
          📝 Posty
        </a>
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
