import React, { useState } from 'react';
import Dashboard from './features/charts/components/Dashboard';
import BacktestForm from './features/backtest/components/BacktestForm';
import { Activity, Layers, History } from 'lucide-react';
import './App.css';

function App() {
  const [view, setView] = useState('live'); // 'live', 'backtest', or 'archive'

  return (
    <div className="App">
      <nav className="main-nav">
        <div className="nav-logo" onClick={() => setView('live')}>
          <Activity size={24} color="#f3ba2f" />
          <span>Antigravity Markets</span>
        </div>
        <div className="nav-links">
          <button 
            className={`nav-btn ${view === 'live' ? 'active' : ''}`} 
            onClick={() => setView('live')}
          >
            <Activity size={18} /> Live Dashboard
          </button>
          <button 
            className={`nav-btn ${view === 'backtest' ? 'active' : ''}`} 
            onClick={() => setView('backtest')}
          >
            <Layers size={18} /> Backtest Config
          </button>
          <button 
            className={`nav-btn ${view === 'archive' ? 'active' : ''}`} 
            onClick={() => setView('archive')}
          >
            <History size={18} /> Backtest Archive
          </button>
        </div>
      </nav>

      <main className="view-container">
        {view === 'live' && <Dashboard />}
        {(view === 'backtest' || view === 'archive') && <BacktestForm view={view} setView={setView} />}
      </main>

      <div className="version-badge">v8.2.4 Backtest Engine [Modularized]</div>
    </div>
  );
}

export default App;

