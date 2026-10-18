import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MarketsProvider } from './data/marketsContext';
import { applyReducedMotion, loadReducedMotion, storedMotionChoice } from './data/motion';
import TitleScreen from './pages/TitleScreen';
import TracksPage from './pages/TracksPage';
import DailyPage from './pages/DailyPage';
import RidePage from './pages/RidePage';
import ReplayPage from './pages/ReplayPage';
import AboutPage from './pages/AboutPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// The stored reduced-motion choice is applied once, before any toggle mounts
// (so /ride, which has no TopStrip, still gets it). Until the rider chooses,
// the OS setting is followed live.
function MotionPreference() {
  useEffect(() => {
    applyReducedMotion(loadReducedMotion());
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (storedMotionChoice() === null) applyReducedMotion(media.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return null;
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#f0f0f2] font-sans antialiased">
      <BrowserRouter>
        <MarketsProvider>
          <ScrollToTop />
          <MotionPreference />
          <Routes>
            <Route path="/" element={<TitleScreen />} />
            <Route path="/tracks" element={<TracksPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/ride/:marketId" element={<RidePage />} />
            <Route path="/r/:payload" element={<ReplayPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MarketsProvider>
      </BrowserRouter>
    </div>
  );
}
