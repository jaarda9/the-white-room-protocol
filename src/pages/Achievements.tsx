import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Lock, Award } from 'lucide-react';
import { ActiveChallenges } from '@/components/ActiveChallenges';
import { 
  ACHIEVEMENTS, 
  getAchievementStats, 
  getAchievementProgress,
  AchievementCategory,
  AchievementTier,
  Achievement 
} from '@/lib/achievements';
import { getUserProfile } from '@/lib/storage';

const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: 'text-orange-600 border-orange-600/50 bg-orange-50 dark:bg-orange-950',
  silver: 'text-slate-400 border-slate-400/50 bg-slate-50 dark:bg-slate-900',
  gold: 'text-yellow-500 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950',
  platinum: 'text-purple-400 border-purple-400/50 bg-purple-50 dark:bg-purple-950',
  limited: 'text-pink-500 border-pink-500/50 bg-pink-50 dark:bg-pink-950',
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  training: 'Training',
  mastery: 'Mastery',
  streak: 'Streaks',
  milestone: 'Milestones',
  special: 'Special',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function Achievements() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(getAchievementStats());
  const [profile, setProfile] = useState(getUserProfile());
  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategory>('all');

  useEffect(() => {
    const updatedProfile = getUserProfile();
    const updatedStats = getAchievementStats();
    setProfile(updatedProfile);
    setStats(updatedStats);
  }, []);

  const unlockedCount = Object.values(stats.achievements).filter(a => a.unlocked).length;
  const totalCount = ACHIEVEMENTS.filter(a => !a.hidden).length;
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100);

  const filteredAchievements = ACHIEVEMENTS.filter(achievement => {
    if (achievement.hidden && !stats.achievements[achievement.id]?.unlocked) return false;
    if (selectedCategory === 'all') return true;
    return achievement.category === selectedCategory;
  });

  const renderAchievementCard = (achievement: Achievement) => {
    const progress = getAchievementProgress(achievement.id);
    const isUnlocked = progress?.unlocked || false;
    const currentProgress = progress?.progress || 0;
    const progressPercentage = Math.min(100, (currentProgress / achievement.requirement.target) * 100);

    return (
      <Card
        key={achievement.id}
        className={`p-4 sm:p-6 ${isUnlocked ? TIER_COLORS[achievement.tier] : 'opacity-60 bg-muted'} border-2 transition-all hover:scale-[1.02]`}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`text-3xl sm:text-4xl flex-shrink-0 ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
            {isUnlocked ? achievement.icon : <Lock className="w-8 h-8 sm:w-10 sm:h-10" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base sm:text-lg truncate">{achievement.name}</h3>
                <p className="text-xs sm:text-sm opacity-80 line-clamp-2">{achievement.description}</p>
              </div>
              <Badge variant="outline" className={`${TIER_COLORS[achievement.tier]} flex-shrink-0 text-xs`}>
                {achievement.tier.toUpperCase()}
              </Badge>
            </div>
            
            {!isUnlocked && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Progress</span>
                  <span>{currentProgress} / {achievement.requirement.target}</span>
                </div>
                <Progress value={progressPercentage} className="h-1.5 sm:h-2" />
              </div>
            )}
            
            {isUnlocked && progress?.unlockedAt && (
              <p className="text-xs opacity-70 mt-2">
                Unlocked: {new Date(progress.unlockedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Achievements</h1>
          </div>
          
          {/* Active Challenges */}
          <div className="mb-6">
            <ActiveChallenges />
          </div>
          
          {/* Progress Summary */}
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">{unlockedCount} / {totalCount}</h2>
                <p className="text-xs sm:text-sm opacity-70">Achievements Unlocked</p>
              </div>
              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-bold text-primary">{completionPercentage}%</div>
                <p className="text-xs opacity-70">Complete</p>
              </div>
            </div>
            <Progress value={completionPercentage} className="h-2 sm:h-3" />
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
            <Card className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-blue-500">{stats.totalQuests}</div>
              <div className="text-xs opacity-70">Total Quests</div>
            </Card>
            <Card className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-purple-500">{stats.mentalChallenges}</div>
              <div className="text-xs opacity-70">Mental Challenges</div>
            </Card>
            <Card className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-green-500">{stats.physicalWorkouts}</div>
              <div className="text-xs opacity-70">Physical Workouts</div>
            </Card>
            <Card className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-orange-500">{stats.socialScenarios}</div>
              <div className="text-xs opacity-70">Social Scenarios</div>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)} className="mb-4 sm:mb-6">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap sm:flex-nowrap">
            <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Achievements Grid */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {filteredAchievements.length > 0 ? (
            filteredAchievements.map(renderAchievementCard)
          ) : (
            <Card className="col-span-2 p-8 sm:p-12 text-center">
              <Award className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
              <p className="text-base sm:text-lg opacity-70">No achievements in this category yet</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
