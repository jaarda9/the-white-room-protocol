import { useState } from 'react';
import { UserProfile } from '@/lib/types';
import { addXP, saveUserProfile } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import { Info, Check } from 'lucide-react';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
}

interface QuestItem {
  id: string;
  label: string;
  targetCount: number;
  currentCount: number;
  unit: string;
  completed: boolean;
}

export const SoloDailyQuestWindow = ({ profile, onProfileUpdated }: Props) => {
  const [claimed, setClaimed] = useState(false);
  const [questCategory, setQuestCategory] = useState<'strength' | 'mental' | 'custom'>('strength');

  const [strengthQuests, setStrengthQuests] = useState<QuestItem[]>([
    { id: 'pushups', label: 'Push-ups', targetCount: 100, currentCount: 100, unit: '', completed: true },
    { id: 'situps', label: 'Sit-ups', targetCount: 100, currentCount: 100, unit: '', completed: true },
    { id: 'squats', label: 'Squats', targetCount: 100, currentCount: 100, unit: '', completed: true },
    { id: 'running', label: 'Running', targetCount: 10, currentCount: 10, unit: 'km', completed: true },
  ]);

  const [mentalQuests, setMentalQuests] = useState<QuestItem[]>([
    { id: 'reading', label: 'Cognitive Reading', targetCount: 30, currentCount: 30, unit: 'min', completed: true },
    { id: 'focus', label: 'Deep Focus Chamber', targetCount: 45, currentCount: 45, unit: 'min', completed: true },
    { id: 'chess', label: 'Strategic Chess Tactics', targetCount: 3, currentCount: 3, unit: 'games', completed: true },
  ]);

  const currentQuests = questCategory === 'strength' ? strengthQuests : mentalQuests;
  const setQuests = questCategory === 'strength' ? setStrengthQuests : setMentalQuests;

  const toggleItem = (id: string) => {
    systemSound.playClick();
    setQuests((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !item.completed;
          return {
            ...item,
            completed: next,
            currentCount: next ? item.targetCount : 0,
          };
        }
        return item;
      })
    );
  };

  const handleIncrement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    systemSound.playClick();
    setQuests((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const step = item.unit === 'km' ? 1 : 10;
          const newCount = Math.min(item.targetCount, item.currentCount + step);
          return {
            ...item,
            currentCount: newCount,
            completed: newCount >= item.targetCount,
          };
        }
        return item;
      })
    );
  };

  const allCompleted = currentQuests.every((q) => q.completed);

  const handleClaim = () => {
    if (!allCompleted) {
      systemSound.playClick();
      return;
    }
    systemSound.playSystemChime();
    setClaimed(true);

    const prevLevel = profile.level;
    // Award 3 Ability Points and 200 XP
    const withAP: UserProfile = {
      ...profile,
      availableAP: (profile.availableAP ?? 12) + 3,
      fatigue: 0, // Full status recovery!
    };
    const updated = addXP(withAP, 200);
    saveUserProfile(updated);
    if (updated.level > prevLevel) {
      systemSound.playLevelUp();
    }
    onProfileUpdated(updated);
  };

  return (
    <div className="anime-window system-blueprint-bg system-window-corners p-6 sm:p-8 max-w-lg mx-auto w-full relative">
      <div className="corner-ticks" />

      {/* Top Header: [ (!) QUEST INFO ] matching Screenshot 2 */}
      <div className="border border-cyan-400/80 bg-black/60 p-2 sm:p-2.5 mb-5 flex items-center justify-center gap-3 shadow-[0_0_15px_rgba(82,210,246,0.35)]">
        <div className="w-7 h-7 rounded-full border border-cyan-300 flex items-center justify-center text-cyan-300 shrink-0">
          <Info className="w-4 h-4 stroke-[2.5]" />
        </div>
        <h2 className="text-lg sm:text-xl font-mono font-bold tracking-[0.25em] text-white anime-glow-text">
          QUEST INFO
        </h2>
      </div>

      {/* Subtitle Line: [Daily Quest: Strength Training has arrived.] */}
      <div className="text-center font-mono text-xs sm:text-sm text-cyan-200/90 mb-5">
        {questCategory === 'strength'
          ? '[Daily Quest: Strength Training has arrived.]'
          : '[Daily Quest: Cognitive Enhancement has arrived.]'}
      </div>

      {/* GOAL Header with double underline */}
      <div className="text-center mb-6">
        <div className="inline-block border-b-2 border-t-0 border-cyan-400/80 pb-0.5">
          <div className="border-b border-cyan-400/60 pb-0.5">
            <span className="font-mono text-sm sm:text-base font-bold text-white tracking-[0.25em] anime-glow-text px-4">
              GOAL
            </span>
          </div>
        </div>
      </div>

      {/* Training Checklist: Push-ups, Sit-ups, Squats, Running (Exact match to Screenshot 2) */}
      <div className="space-y-4 font-mono text-sm sm:text-base mb-8 max-w-sm mx-auto">
        {currentQuests.map((q) => (
          <div
            key={q.id}
            onClick={() => toggleItem(q.id)}
            className="flex items-center justify-between p-2.5 border border-cyan-500/20 bg-black/40 hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer transition-all group"
          >
            <span className="text-white group-hover:text-cyan-200 font-medium">
              {q.label}
            </span>

            <div className="flex items-center gap-3">
              <span
                onClick={(e) => handleIncrement(q.id, e)}
                className="text-cyan-200 font-mono text-xs sm:text-sm hover:text-white"
                title="Click to advance progress"
              >
                [{q.currentCount}/{q.targetCount}
                {q.unit ? q.unit : ''}]
              </span>

              {/* Checkbox with glowing icon matching screenshot */}
              <div
                className={`w-5 h-5 border rounded-sm flex items-center justify-center transition-all ${
                  q.completed
                    ? 'border-cyan-300 bg-cyan-950/80 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'border-cyan-500/50 bg-black/60 text-transparent'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Warning Text: red penalty highlight (Exact match to Screenshot 2) */}
      <div className="text-center font-mono text-xs text-gray-300 mb-6 leading-relaxed max-w-xs mx-auto">
        <div>WARNING: Failure to complete</div>
        <div>
          the daily quest will result in an appropriate{' '}
          <span className="text-red-500 font-bold tracking-wide">penalty.</span>
        </div>
      </div>

      {/* Bottom Action Button: Square button with Checkmark matching Screenshot 2 */}
      <div className="flex flex-col items-center justify-center">
        <button
          onClick={handleClaim}
          className={`w-12 h-12 border-2 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(82,210,246,0.3)] ${
            allCompleted
              ? 'border-cyan-300 bg-black/70 hover:bg-cyan-400/20 text-emerald-400 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
              : 'border-cyan-500/30 bg-black/50 text-gray-500 cursor-not-allowed'
          }`}
          title={allCompleted ? 'Claim Quest Rewards' : 'Complete all goals first'}
        >
          <Check className="w-7 h-7 stroke-[3]" />
        </button>

        {claimed && (
          <div className="mt-3 text-center font-mono text-xs text-emerald-400 anime-glow-text">
            REWARDS CLAIMED: STATUS RECOVERED • AP +3 • EXP +200
          </div>
        )}
      </div>

      {/* Secondary Protocol Switcher */}
      <div className="mt-6 pt-3 border-t border-cyan-500/20 flex justify-center gap-4 text-[11px] font-mono">
        <button
          onClick={() => {
            systemSound.playClick();
            setQuestCategory('strength');
          }}
          className={`hover:text-cyan-300 transition-colors ${
            questCategory === 'strength' ? 'text-cyan-300 font-bold underline' : 'text-gray-500'
          }`}
        >
          STRENGTH REGIMEN
        </button>
        <span className="text-gray-700">•</span>
        <button
          onClick={() => {
            systemSound.playClick();
            setQuestCategory('mental');
          }}
          className={`hover:text-cyan-300 transition-colors ${
            questCategory === 'mental' ? 'text-cyan-300 font-bold underline' : 'text-gray-500'
          }`}
        >
          COGNITIVE REGIMEN
        </button>
      </div>
    </div>
  );
};
