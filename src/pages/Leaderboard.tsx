import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getUserProfile, getHunterRank } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';

interface LeaderboardEntry {
  rank: number;
  fullName: string;
  level: number;
  xp: number;
  topStat: { key: string; value: number };
  isCurrentUser: boolean;
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentProfile = getUserProfile();
    setEntries([
      {
        rank: 1,
        fullName: `${currentProfile.displayName || currentProfile.fullName || 'Sung Jin-woo'}`,
        level: currentProfile.level,
        xp: currentProfile.xp,
        topStat: { key: 'STR', value: currentProfile.visibleStats.STR || 10 },
        isCurrentUser: true,
      },
      {
        rank: 2,
        fullName: 'Cha Hae-In',
        level: Math.max(1, currentProfile.level - 2),
        xp: 14500,
        topStat: { key: 'AGI', value: 92 },
        isCurrentUser: false,
      },
      {
        rank: 3,
        fullName: 'Choi Jong-In',
        level: Math.max(1, currentProfile.level - 4),
        xp: 13200,
        topStat: { key: 'INT', value: 95 },
        isCurrentUser: false,
      },
      {
        rank: 4,
        fullName: 'Baek Yoonho',
        level: Math.max(1, currentProfile.level - 6),
        xp: 11800,
        topStat: { key: 'VIT', value: 88 },
        isCurrentUser: false,
      },
      {
        rank: 5,
        fullName: 'Go Gunhee',
        level: Math.max(1, currentProfile.level - 8),
        xp: 10400,
        topStat: { key: 'PER', value: 85 },
        isCurrentUser: false,
      },
    ]);
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
              GLOBAL HUNTER RANKINGS
            </h1>
          </div>
          <p className="text-xs font-mono text-white/80 mt-1">
            Official association classification based on accumulated combat power and player levels.
          </p>
        </div>

        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#9fd3ff] font-mono text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              [ SYNCHRONIZING WITH ASSOCIATION SERVERS... ]
            </div>
          ) : (
            <div className="space-y-3 font-mono">
              {entries.map((entry) => {
                const hunterRank = getHunterRank(entry.level);
                return (
                  <div
                    key={entry.rank}
                    className={`p-3.5 border rounded-[2px] transition-all flex items-center justify-between gap-3 ${
                      entry.isCurrentUser
                        ? 'border-white bg-white/10 shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                        : 'border-white/20 bg-[#061424]/75 hover:border-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 shrink-0 border flex items-center justify-center font-bold text-xs ${
                          entry.rank === 1
                            ? 'border-yellow-400/80 bg-yellow-950/40 text-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                            : 'border-white/30 text-gray-300'
                        }`}
                      >
                        #{entry.rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm truncate ${
                              entry.isCurrentUser ? 'text-white anime-glow-text' : 'text-gray-200'
                            }`}
                          >
                            {entry.fullName}
                          </span>
                          {entry.isCurrentUser && (
                            <span className="text-[9px] px-1.5 py-0.5 border border-white bg-white text-black font-bold tracking-wider">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          TOP STAT: <span className="text-[#9fd3ff] font-bold">{entry.topStat.key}</span> ({entry.topStat.value})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <div className="text-xs font-bold text-white">
                          LV.{entry.level}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {entry.xp.toLocaleString()} EXP
                        </div>
                      </div>
                      <div className="px-2 py-0.5 border border-white/40 text-[10px] text-[#9fd3ff] bg-black/40">
                        {hunterRank}-RANK
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Leaderboard;
