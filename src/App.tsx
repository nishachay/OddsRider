import { useCallback, useState } from 'react';
import PhaserGame from './game/PhaserGame';
import HudOverlay from './components/HudOverlay';
import Lobby from './components/Lobby';
import { bus, EV } from './game/bus';
import type { Ride } from './data/polymarket';

export default function App() {
  const [view, setView] = useState<'lobby' | 'game'>('lobby');

  const handleSelectMarket = useCallback((ride: Ride) => {
    setView('game');
    // Allow React state transition to settle then emit market load
    setTimeout(() => {
      bus.emit(EV.LOAD_MARKET, ride);
    }, 50);
  }, []);

  const handleOpenLobby = useCallback(() => {
    setView('lobby');
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0a0a0b]">
      {/* 1. Underlying Phaser 2D Physics World */}
      <PhaserGame />

      {/* 2. State Switcher: Lobby / Home Page Feed vs In-Game Cockpit HUD */}
      {view === 'game' ? (
        <HudOverlay onOpenLobby={handleOpenLobby} />
      ) : (
        <Lobby onSelectMarket={handleSelectMarket} />
      )}
    </main>
  );
}
