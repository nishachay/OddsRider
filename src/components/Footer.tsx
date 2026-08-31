export default function Footer() {
  return (
    <footer className="w-full bg-[#0a0a0b] border-t border-[#181d26] mt-24 py-16 select-none font-sans">
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand */}
        <div className="flex flex-col gap-3 md:col-span-2">
          <span className="font-display font-black text-xl tracking-[0.16em] uppercase text-[#00df81]">
            ODDSRIDER
          </span>
          <p className="text-xs text-[#7c7f86] max-w-xs leading-relaxed">
            Real market & prediction data turned into motocross tracks you can ride.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <span className="w-7 h-7 rounded-full bg-[#141820] border border-[#1f242d] flex items-center justify-center text-xs text-[#7c7f86] hover:text-white cursor-pointer">
              𝕏
            </span>
            <span className="w-7 h-7 rounded-full bg-[#141820] border border-[#1f242d] flex items-center justify-center text-xs text-[#7c7f86] hover:text-white cursor-pointer">
              in
            </span>
            <span className="w-7 h-7 rounded-full bg-[#141820] border border-[#1f242d] flex items-center justify-center text-xs text-[#7c7f86] hover:text-white cursor-pointer">
              ☕
            </span>
          </div>
        </div>

        {/* Play */}
        <div className="flex flex-col gap-2.5 text-xs text-[#7c7f86]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white mb-1">
            PLAY
          </span>
          <span className="hover:text-white cursor-pointer">Prediction markets</span>
          <span className="hover:text-white cursor-pointer">Crypto charts</span>
          <span className="hover:text-white cursor-pointer">Daily challenge & leaderboard</span>
          <span className="hover:text-white cursor-pointer">Legendary crashes</span>
        </div>

        {/* Company */}
        <div className="flex flex-col gap-2.5 text-xs text-[#7c7f86]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white mb-1">
            COMPANY
          </span>
          <span className="hover:text-white cursor-pointer">About OddsRider</span>
          <span className="hover:text-white cursor-pointer">Contact</span>
          <span className="hover:text-white cursor-pointer">Privacy</span>
          <span className="hover:text-white cursor-pointer">Terms</span>
          <span className="hover:text-white cursor-pointer">Legal</span>
        </div>

      </div>

      <div className="max-w-5xl mx-auto px-4 mt-12 pt-6 border-t border-[#141820] text-center font-mono text-[11px] text-[#525866]">
        Built with real market & prediction data • Not financial advice
      </div>
    </footer>
  );
}
