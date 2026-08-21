import PhaserGame from './game/PhaserGame';
import HudOverlay from './components/HudOverlay';

export default function App() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <PhaserGame />
      <HudOverlay />
    </main>
  );
}
