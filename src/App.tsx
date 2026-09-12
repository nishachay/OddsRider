import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MarketsProvider } from './data/marketsContext';
import HomePage from './pages/HomePage';
import PreviewPage from './pages/PreviewPage';
import RidePage from './pages/RidePage';
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
            <Route path="/" element={<HomePage />} />
            <Route path="/preview/:marketId" element={<PreviewPage />} />
            <Route path="/ride/:marketId" element={<RidePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MarketsProvider>
      </BrowserRouter>
    </div>
  );
}
