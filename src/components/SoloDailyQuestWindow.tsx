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
    <div className="relative max-w-[560px] w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-9 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
      {/* Top Header: Centered Box matching Status window */}
      <div className="relative flex items-center justify-center pb-2 mb-4">
        <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#9fd3ff]" />
            <span className="font-mono font-extrabold tracking-[0.28em] text-base sm:text-lg text-white anime-glow-text">
              QUEST INFO
            </span>
          </div>
        </div>
      </div>

      {/* Subtitle Line: [Daily Quest: Strength Training has arrived.] */}
      <div className="text-center font-mono text-xs sm:text-sm text-white/90 mb-5">
        {questCategory === 'strength'
          ? '[Daily Quest: Strength Training has arrived.]'
          : '[Daily Quest: Cognitive Enhancement has arrived.]'}
      </div>

      {/* GOAL Header with double underline */}
      <div className="text-center mb-5">
        <div className="inline-block border-b-2 border-t-0 border-white/70 pb-0.5">
          <div className="border-b border-white/40 pb-0.5">
            <span className="font-mono text-sm sm:text-base font-bold text-white tracking-[0.25em] anime-glow-text px-4">
              GOAL
            </span>
          </div>
        </div>
      </div>

      {/* Training Checklist: Push-ups, Sit-ups, Squats, Running */}
      <div className="border border-white/45 bg-[#061424]/75 p-4 sm:p-5 mb-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px] space-y-3">
        {currentQuests.map((q) => (
          <div
            key={q.id}
            onClick={() => toggleItem(q.id)}
            className="flex items-center justify-between p-3 border border-white/20 bg-white/5 hover:border-white/60 hover:bg-white/10 cursor-pointer transition-all group rounded-[2px]"
          >
            <span className="text-white group-hover:text-[#9fd3ff] font-medium text-xs sm:text-sm">
              {q.label}
            </span>

            <div className="flex items-center gap-3">
              <span
                onClick={(e) => handleIncrement(q.id, e)}
                className="text-[#9fd3ff] font-mono text-xs sm:text-sm hover:text-white"
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
                    : 'border-white/40 bg-black/60 text-transparent'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Warning Text: red penalty highlight */}
      <div className="text-center font-mono text-xs text-white/80 mb-6 leading-relaxed max-w-xs mx-auto">
        <div>WARNING: Failure to complete</div>
        <div>
          the daily quest will result in an appropriate{' '}
          <span className="text-red-400 font-bold tracking-wide">penalty.</span>
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="flex flex-col items-center justify-center">
        <button
          onClick={handleClaim}
          className={`w-12 h-12 border-2 rounded-[2px] flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] ${
            allCompleted
              ? 'border-white bg-[#061426] hover:bg-white/20 text-emerald-400 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
              : 'border-white/30 bg-black/50 text-gray-500 cursor-not-allowed'
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
      <div className="mt-6 pt-3 border-t border-white/20 flex justify-center gap-4 text-[11px] font-mono">
        <button
          onClick={() => {
            systemSound.playClick();
            setQuestCategory('strength');
          }}
          className={`hover:text-white transition-colors ${
            questCategory === 'strength' ? 'text-[#9fd3ff] font-bold underline' : 'text-white/50'
          }`}
        >
          STRENGTH REGIMEN
        </button>
        <span className="text-white/30">•</span>
        <button
          onClick={() => {
            systemSound.playClick();
            setQuestCategory('mental');
          }}
          className={`hover:text-white transition-colors ${
            questCategory === 'mental' ? 'text-[#9fd3ff] font-bold underline' : 'text-white/50'
          }`}
        >
          COGNITIVE REGIMEN
        </button>
      </div>
    </div>
  );
};
