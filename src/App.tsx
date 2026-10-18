import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MarketsProvider } from './data/marketsContext';
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

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#f0f0f2] font-sans antialiased">
      <BrowserRouter>
        <MarketsProvider>
          <ScrollToTop />
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
