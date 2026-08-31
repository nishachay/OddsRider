interface NavbarProps {
  onGoHome: () => void;
  onSelectTab: (tab: string) => void;
}

export default function Navbar({ onGoHome, onSelectTab }: NavbarProps) {
  return (
    <header className="w-full bg-[#0a0a0b] border-b border-[#1c2029] select-none sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand Logo (StonkRider style) */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 font-display font-black text-xl tracking-[0.16em] uppercase text-[#00df81] hover:opacity-90 transition-opacity cursor-pointer"
        >
          ODDSRIDER
        </button>

        {/* Navigation Links */}
        <nav className="flex items-center gap-6 text-sm text-[#7c7f86] font-medium">
          <button
            onClick={() => onSelectTab('ALL')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Markets
          </button>
          <button
            onClick={() => onSelectTab('LEGENDARY')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Legendary Crashes
          </button>
          <button
            onClick={onGoHome}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Leaderboard
          </button>
          <button
            onClick={onGoHome}
            className="hover:text-white transition-colors cursor-pointer"
          >
            About
          </button>
        </nav>

      </div>
    </header>
  );
}
