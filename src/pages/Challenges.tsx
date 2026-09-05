import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Swords } from 'lucide-react';
import { ActiveChallenges } from '@/components/ActiveChallenges';

export default function Challenges() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">


      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        <div className="space-y-6">
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
              <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
                <Swords className="w-5 h-5 text-[#9fd3ff]" />
                TIME-LIMITED CHALLENGES
              </h1>
            </div>
            <p className="text-xs font-mono text-white/80 mt-1">
              Complete these special protocol operations before deadline expiry to claim exclusive bonuses.
            </p>
          </div>

          <ActiveChallenges />
        </div>
      </main>
    </div>
  );
}
