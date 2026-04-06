import { motion } from 'framer-motion';
import { UserProgress, ACHIEVEMENTS, COURSE_NODES } from '@/data/courseData';
import { Trophy, Flame, Zap, BookOpen, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProfileDashboardProps {
  progress: UserProgress;
  onReset: () => void;
  onClose: () => void;
}

export default function ProfileDashboard({ progress, onReset, onClose }: ProfileDashboardProps) {
  const totalNodes = COURSE_NODES.length;
  const completionPct = Math.round((progress.completedNodes.length / totalNodes) * 100);
  const avgScore = progress.completedNodes.length > 0
    ? Math.round(Object.values(progress.quizScores).reduce((a, b) => a + b, 0) / Object.values(progress.quizScores).length)
    : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Your Progress</h2>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">← Back to Map</button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: <Zap className="w-5 h-5 text-accent" />, label: 'Total XP', value: progress.xp },
          { icon: <Flame className="w-5 h-5 text-destructive" />, label: 'Streak', value: `${progress.streak} day${progress.streak !== 1 ? 's' : ''}` },
          { icon: <BookOpen className="w-5 h-5 text-primary" />, label: 'Completed', value: `${progress.completedNodes.length}/${totalNodes}` },
          { icon: <Trophy className="w-5 h-5 text-accent" />, label: 'Avg Score', value: `${avgScore}%` },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <div className="flex justify-center mb-2">{stat.icon}</div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium">Course Progress</span>
          <span className="text-sm text-primary font-mono">{completionPct}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary to-success rounded-full"
          />
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" /> Achievements
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACHIEVEMENTS.map(a => {
            const unlocked = progress.achievements.includes(a.id);
            return (
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${unlocked ? 'border-accent/30 bg-accent/5' : 'border-border bg-muted/30 opacity-50'}`}>
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <p className={`text-sm font-medium ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onReset} className="gap-2 text-muted-foreground hover:text-destructive">
          <RotateCcw className="w-4 h-4" /> Reset Progress
        </Button>
      </div>
    </motion.div>
  );
}
