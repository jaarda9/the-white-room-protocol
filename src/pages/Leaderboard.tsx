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
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>
        </div>

        <div className="anime-window p-6 text-center">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
            GLOBAL HUNTER RANKINGS
          </h1>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Official association classification based on accumulated combat power and player levels.
          </p>
        </div>

        <div className="anime-window p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-cyan-400 font-mono text-xs">
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
                    className={`p-3.5 border transition-all flex items-center justify-between gap-3 ${
                      entry.isCurrentUser
                        ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(82,210,246,0.2)]'
                        : 'border-cyan-500/20 bg-black/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 shrink-0 border flex items-center justify-center font-bold text-xs ${
                          entry.rank === 1
                            ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                            : 'border-gray-700 text-gray-400'
                        }`}
                      >
                        #{entry.rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm truncate ${
                              entry.isCurrentUser ? 'text-cyan-300' : 'text-white'
                            }`}
                          >
                            {entry.fullName}
                          </span>
                          {entry.isCurrentUser && (
                            <span className="text-[9px] px-1.5 py-0.2 border border-cyan-400 bg-cyan-400 text-black font-bold">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          TOP STAT: <span className="text-cyan-300 font-bold">{entry.topStat.key}</span> ({entry.topStat.value})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <div className="text-xs font-bold text-white">
                          LV.{entry.level}
                        </div>
                        <div className="text-[10px] text-cyan-400/80">
                          {entry.xp.toLocaleString()} EXP
                        </div>
                      </div>
                      <div className="px-2 py-0.5 border border-cyan-500/40 text-[10px] text-cyan-300">
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
