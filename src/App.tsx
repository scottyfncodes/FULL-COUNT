import { useState } from 'react';
import { goBack, navigate, useRoute } from './router';
import { ScheduleView } from './components/ScheduleView';
import { GameView, type TopbarInfo } from './components/GameView';
import { Chevron, Logo } from './components/bits';

export function App() {
  const route = useRoute();
  const [top, setTop] = useState<TopbarInfo | null>(null);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          {route.view === 'game' ? (
            <button className="back" onClick={() => goBack('/')}>
              <Chevron dir="left" /> Games
            </button>
          ) : (
            <span />
          )}
          <a
            href="/"
            className="wordmark"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            aria-label="Full Count, today's games"
          >
            <Logo />
            {route.view === 'schedule' ? <h1 style={{ font: 'inherit', margin: 0 }}>Full Count</h1> : 'Full Count'}
          </a>
          {route.view === 'game' && top ? (
            <span className={`tag tag--${top.tag.tone}`}>
              {top.tag.tone === 'live' && <span className="live-dot" aria-hidden="true" />}
              {top.tag.text}
            </span>
          ) : (
            <span />
          )}
        </div>
      </header>

      <main className="main" id="main">
        {route.view === 'schedule' ? (
          <ScheduleView key={route.date ?? 'today'} date={route.date} />
        ) : (
          <GameView key={`${route.pk}-${route.timecode}`} pk={route.pk} timecode={route.timecode} onTitle={setTop} />
        )}
      </main>

      <footer className="footer">
        Data from the MLB Stats API, refreshed automatically. Team marks are property of their respective clubs. Not affiliated with MLB.
      </footer>
    </div>
  );
}
