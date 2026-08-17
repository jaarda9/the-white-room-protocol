import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { ArrowLeft, Trophy, Medal, Shield, Loader2, Crown, Sparkles, Flame } from 'lucide-react';
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
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/leaderboard?_t=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        const data = await res.json();

        const currentProfile = getUserProfile();
        const ranked: LeaderboardEntry[] = (data.leaderboard || []).map(
          (entry: any, idx: number) => {
            const stats = entry.visibleStats || {};
            const statEntries = Object.entries(stats) as [string, number][];
            const top = statEntries.reduce(
              (best, [k, v]) => (v > best.value ? { key: k, value: v } : best),
              { key: '-', value: 0 }
            );
            return {
              rank: idx + 1,
              fullName: entry.fullName || 'Unknown Hunter',
              level: entry.level || 1,
              xp: entry.totalXp || 0,
              topStat: top,
              isCurrentUser: entry.userId === currentProfile.id,
            };
          }
        );
        setEntries(ranked);
      } catch (e: any) {
        // Provide fallback local rank list if server endpoint is offline
        const currentProfile = getUserProfile();
        setEntries([
          {
            rank: 1,
            fullName: `${currentProfile.displayName || currentProfile.pseudo} (Shadow Monarch)`,
            level: currentProfile.level,
            xp: currentProfile.xp,
            topStat: { key: 'Strength', value: currentProfile.visibleStats.strength },
            isCurrentUser: true,
          },
          {
            rank: 2,
            fullName: 'Cha Hae-In (Sword Dancer)',
            level: Math.max(1, currentProfile.level - 2),
            xp: 14500,
            topStat: { key: 'Agility', value: 92 },
            isCurrentUser: false,
          },
          {
            rank: 3,
            fullName: 'Choi Jong-In (Ultimate Flame)',
            level: Math.max(1, currentProfile.level - 4),
            xp: 13200,
            topStat: { key: 'Intelligence', value: 95 },
            isCurrentUser: false,
          },
          {
            rank: 4,
            fullName: 'Baek Yoonho (White Tiger)',
            level: Math.max(1, currentProfile.level - 6),
            xp: 11800,
            topStat: { key: 'Strength', value: 88 },
            isCurrentUser: false,
          },
          {
            rank: 5,
            fullName: 'Go Gunhee (Association President)',
            level: Math.max(1, currentProfile.level - 8),
            xp: 10400,
            topStat: { key: 'Vitality', value: 85 },
            isCurrentUser: false,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] text-foreground scanlines pb-16">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="system-btn px-3 py-1.5 flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>

          <span className="text-xs font-mono text-primary/80 border border-primary/40 px-2 py-0.5 bg-primary/10">
            HUNTER ASSOCIATION GLOBAL RANKINGS
          </span>
        </div>

        {/* Header Window */}
        <div className="system-window-monarch tech-corners p-5 sm:p-6 text-center">
          <div className="inline-flex items-center justify-center p-3 border border-amber-400/50 bg-amber-950/40 rounded-none mb-3 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
            <Crown className="w-8 h-8 text-amber-300 monarch-glow-text" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-widest monarch-glow-text">
            [ S-RANK GLOBAL HUNTER ROSTER ]
          </h1>
          <p className="text-xs font-mono text-amber-300/80 mt-1 max-w-lg mx-auto">
            Official association classification based on accumulated combat power, attributes, and protocol levels.
          </p>
        </div>

        {/* Leaderboard Table */}
        <div className="system-window tech-corners p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-primary font-mono text-xs">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              [ SYNCHRONIZING WITH ASSOCIATION SERVERS... ]
            </div>
          ) : (
            <div className="space-y-2.5">
              {entries.map((entry) => {
                const hunterRank = getHunterRank(entry.level);
                const isTop3 = entry.rank <= 3;

                return (
                  <div
                    key={entry.rank}
                    className={`p-3.5 border transition-all flex items-center justify-between gap-3 ${entry.isCurrentUser ? 'border-primary bg-primary/20 shadow-[0_0_15px_rgba(0,240,255,0.25)]' : isTop3 ? 'border-amber-500/40 bg-amber-950/20' : 'border-primary/20 bg-black/40'}`}
                  >
                    {/* Rank Badge + Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 shrink-0 border flex items-center justify-center font-display font-bold text-sm ${entry.rank === 1 ? 'border-amber-400 bg-amber-400/20 text-amber-300' : entry.rank === 2 ? 'border-gray-300 bg-gray-300/20 text-gray-200' : entry.rank === 3 ? 'border-amber-600 bg-amber-600/20 text-amber-500' : 'border-primary/40 text-primary'}`}>
                        #{entry.rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-display font-bold text-sm sm:text-base truncate ${entry.isCurrentUser ? 'text-primary system-glow-text' : 'text-white'}`}>
                            {entry.fullName}
                          </span>
                          {entry.isCurrentUser && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 border border-primary bg-primary text-black font-bold">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                          TOP STAT: <span className="text-primary font-bold">{entry.topStat.key.toUpperCase()}</span> ({entry.topStat.value})
                        </div>
                      </div>
                    </div>

                    {/* Level & Rank */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <div className="text-xs sm:text-sm font-display font-bold text-white">
                          LV.{entry.level}
                        </div>
                        <div className="text-[10px] font-mono text-primary/80">
                          {entry.xp.toLocaleString()} EXP
                        </div>
                      </div>

                      <div className="px-2.5 py-1 border border-primary/50 bg-black/60 font-mono font-bold text-xs text-amber-300">
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
