import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Medal, Shield, Loader2 } from 'lucide-react';
import { getUserProfile } from '@/lib/storage';

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
              fullName: entry.fullName || 'Unknown Subject',
              level: entry.level || 1,
              xp: entry.totalXp || 0,
              topStat: top,
              isCurrentUser: entry.userId === currentProfile.id,
            };
          }
        );
        setEntries(ranked);
      } catch (e: any) {
        setError(e.message || 'Could not load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
    return <Shield className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-2 font-mono-data">
            <ArrowLeft className="h-4 w-4 mr-1" /> Return
          </Button>
          <h1 className="text-xl font-bold tracking-wider">PROTOCOL LEADERBOARD</h1>
          <p className="text-xs text-muted-foreground mt-1">Global subject rankings by level &amp; performance</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground text-sm font-mono">FETCHING RANKINGS...</span>
          </div>
        )}

        {error && (
          <div className="border border-destructive/50 bg-destructive/5 p-4 text-center">
            <p className="text-destructive text-sm">⚠ {error}</p>
            <p className="text-muted-foreground text-xs mt-2">Leaderboard API endpoint may not be deployed yet.</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm">No subjects on the leaderboard yet.</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[3rem_1fr_4rem_5rem_6rem] gap-2 px-3 py-2 text-[10px] text-muted-foreground tracking-wider uppercase border-b border-border">
              <span>RANK</span>
              <span>NAME</span>
              <span className="text-center">LVL</span>
              <span className="text-center">XP</span>
              <span className="text-right">TOP STAT</span>
            </div>

            {entries.map((entry) => (
              <div
                key={entry.rank}
                className={`grid grid-cols-[3rem_1fr_4rem_5rem_6rem] gap-2 px-3 py-3 items-center border border-border transition-colors ${
                  entry.isCurrentUser
                    ? 'bg-primary/10 border-primary/40'
                    : 'bg-card hover:bg-accent/5'
                }`}
              >
                <div className="flex items-center gap-1">
                  {getRankIcon(entry.rank)}
                  <span className="font-mono-data text-xs font-bold">{entry.rank}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold truncate block">
                    {entry.fullName}
                    {entry.isCurrentUser && (
                      <span className="text-[10px] text-primary ml-1">(YOU)</span>
                    )}
                  </span>
                </div>
                <span className="text-center font-mono-data text-sm font-bold">{entry.level}</span>
                <span className="text-center font-mono-data text-xs text-muted-foreground">
                  {entry.xp.toLocaleString()}
                </span>
                <span className="text-right font-mono-data text-xs text-primary">
                  {entry.topStat.key} {entry.topStat.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
