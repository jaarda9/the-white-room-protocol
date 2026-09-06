import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Users, Shield } from 'lucide-react';
import { getUserProfile, getHunterRank } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';

interface LeaderboardEntry {
  userId?: string;
  rank: number;
  fullName: string;
  level: number;
  xp: number;
  totalXp?: number;
  topStat: { key: string; value: number };
  isCurrentUser: boolean;
}

function calculateTotalXP(level: number, xp: number): number {
  let total = xp;
  for (let l = 1; l < level; l++) {
    total += Math.floor(100 * Math.pow(1.25, l - 1));
  }
  return total;
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    const currentProfile = getUserProfile();
    const currentSubjectId = localStorage.getItem('whiteroom_session_subject') || currentProfile.id || '';
    const normCurrentId = currentSubjectId ? currentSubjectId.replace(/^SUBJECT-/i, '').trim().toUpperCase() : '';

    // Calculate current user's highest attribute
    const stats = (currentProfile.visibleStats || {}) as Record<string, number>;
    let currentTopKey = 'STR';
    let currentTopVal = Number(stats.STR || 10);
    for (const [k, v] of Object.entries(stats)) {
      const num = Number(v || 10);
      if (num > currentTopVal) {
        currentTopVal = num;
        currentTopKey = k;
      }
    }

    try {
      const res = await fetch(`/api/leaderboard?_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const serverList: any[] = Array.isArray(data.leaderboard) ? data.leaderboard : [];

      let matchedCurrentUser = false;
      const parsedEntries: LeaderboardEntry[] = serverList.map((item: any) => {
        const itemUid = item.userId ? String(item.userId).replace(/^SUBJECT-/i, '').trim().toUpperCase() : '';
        const isUser = Boolean(normCurrentId && itemUid === normCurrentId);
        if (isUser) matchedCurrentUser = true;

        return {
          userId: item.userId,
          rank: 0,
          fullName: isUser
            ? (currentProfile.displayName || currentProfile.fullName || item.fullName)
            : item.fullName,
          level: isUser ? currentProfile.level : item.level,
          xp: isUser ? currentProfile.xp : item.xp,
          totalXp: isUser ? calculateTotalXP(currentProfile.level, currentProfile.xp) : item.totalXp,
          topStat: isUser
            ? { key: currentTopKey, value: currentTopVal }
            : (item.topStat || { key: 'STR', value: 10 }),
          isCurrentUser: isUser,
        };
      });

      // If current active user isn't in server data yet (e.g. freshly created), include them
      if (!matchedCurrentUser) {
        parsedEntries.push({
          userId: currentSubjectId,
          rank: 0,
          fullName: currentProfile.displayName || currentProfile.fullName || 'You (Awakened Hunter)',
          level: currentProfile.level,
          xp: currentProfile.xp,
          totalXp: calculateTotalXP(currentProfile.level, currentProfile.xp),
          topStat: { key: currentTopKey, value: currentTopVal },
          isCurrentUser: true,
        });
      }

      // Sort by level descending, then accumulated XP descending
      parsedEntries.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return (b.totalXp ?? b.xp) - (a.totalXp ?? a.xp);
      });

      // Assign ranks #1, #2, #3...
      const ranked = parsedEntries.map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
      }));

      setEntries(ranked);
    } catch (err) {
      console.warn('Failed to load server rankings, showing local hunter entry:', err);
      // Fallback: show local player
      setEntries([
        {
          rank: 1,
          fullName: currentProfile.displayName || currentProfile.fullName || 'You (Awakened Hunter)',
          level: currentProfile.level,
          xp: currentProfile.xp,
          totalXp: calculateTotalXP(currentProfile.level, currentProfile.xp),
          topStat: { key: currentTopKey, value: currentTopVal },
          isCurrentUser: true,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleManualRefresh = () => {
    systemSound.playClick();
    setRefreshing(true);
    fetchLeaderboard();
  };

  return (
    <div className="min-h-screen pb-24 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">


      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        {/* Navigation & Header Actions */}
        <div className="flex items-center justify-between">

          <button
            onClick={handleManualRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-cyan-400/50 bg-[#061426]/80 text-cyan-200 text-xs font-mono hover:bg-cyan-950/40 hover:border-cyan-300 transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>[ REFRESH RANKS ]</span>
          </button>
        </div>

        {/* Title Box */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
              GLOBAL HUNTER RANKINGS
            </h1>
          </div>
          <p className="text-xs font-mono text-white/80 mt-1">
            Official association classification based on synchronized subject records and combat levels.
          </p>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-cyan-300/80">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>SYNCHRONIZED SUBJECTS: {entries.length}</span>
            </span>
          </div>
        </div>

        {/* Leaderboard Table Container */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#9fd3ff] font-mono text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              [ SYNCHRONIZING WITH ASSOCIATION SERVERS... ]
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs font-mono">
              [ NO HUNTER RECORDS DETECTED IN DATABASE ]
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
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(0,212,255,0.35)]'
                        : 'border-white/20 bg-[#061424]/75 hover:border-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 shrink-0 border flex items-center justify-center font-bold text-xs ${
                          entry.rank === 1
                            ? 'border-yellow-400/80 bg-yellow-950/40 text-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                            : entry.rank === 2
                            ? 'border-gray-300 bg-gray-900/60 text-gray-200'
                            : entry.rank === 3
                            ? 'border-amber-600 bg-amber-950/40 text-amber-300'
                            : 'border-white/30 text-gray-300'
                        }`}
                      >
                        #{entry.rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-xs sm:text-sm truncate ${
                              entry.isCurrentUser ? 'text-white anime-glow-text' : 'text-gray-200'
                            }`}
                          >
                            {entry.fullName}
                          </span>
                          {entry.isCurrentUser && (
                            <span className="text-[9px] px-1.5 py-0.5 border border-cyan-400 bg-cyan-400 text-black font-bold tracking-wider shrink-0">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                          <span>
                            TOP STAT: <span className="text-[#9fd3ff] font-bold">{entry.topStat.key}</span> ({entry.topStat.value})
                          </span>
                          {entry.userId && (
                            <span className="text-gray-500 hidden sm:inline">
                              • ID: {String(entry.userId).slice(0, 16)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white">
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
