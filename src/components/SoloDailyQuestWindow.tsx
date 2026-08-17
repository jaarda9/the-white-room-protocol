import { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'physical' | 'mental' | 'spiritual'>('overview');
  
  // Daily Quests matching the anime screenshot
  const [quests, setQuests] = useState<{
    physical: QuestItem[];
    mental: QuestItem[];
    spiritual: QuestItem[];
  }>({
    physical: [
      { id: 'pushups', label: 'Push-ups', targetCount: 100, currentCount: 0, unit: 'reps', completed: false },
      { id: 'situps', label: 'Sit-ups', targetCount: 100, currentCount: 0, unit: 'reps', completed: false },
      { id: 'squats', label: 'Squats', targetCount: 100, currentCount: 0, unit: 'reps', completed: false },
      { id: 'running', label: 'Running', targetCount: 10, currentCount: 0, unit: 'km', completed: false },
    ],
    mental: [
      { id: 'meditation', label: 'Meditation', targetCount: 10, currentCount: 0, unit: 'min', completed: false },
      { id: 'reading', label: 'Reading Books', targetCount: 30, currentCount: 0, unit: 'min', completed: false },
      { id: 'journaling', label: 'Journaling', targetCount: 10, currentCount: 0, unit: 'min', completed: false },
    ],
    spiritual: [
      { id: 'mindfulness', label: 'Mindfulness & Breathing', targetCount: 15, currentCount: 0, unit: 'min', completed: false },
      { id: 'focus', label: 'Focus Zone Training', targetCount: 25, currentCount: 0, unit: 'min', completed: false },
    ],
  });

  const toggleQuest = (category: 'physical' | 'mental' | 'spiritual', id: string) => {
    systemSound.playClick();
    setQuests((prev) => {
      const list = prev[category].map((item) => {
        if (item.id === id) {
          const nextState = !item.completed;
          return {
            ...item,
            completed: nextState,
            currentCount: nextState ? item.targetCount : 0,
          };
        }
        return item;
      });

      const updated = { ...prev, [category]: list };

      // Check if item was completed to give XP
      const item = list.find((i) => i.id === id);
      if (item?.completed) {
        systemSound.playSystemChime();
        const xpGain = 100;
        const prevLevel = profile.level;
        const newProfile = addXP(profile, xpGain);
        saveUserProfile(newProfile);
        if (newProfile.level > prevLevel) systemSound.playLevelUp();
        onProfileUpdated(newProfile);
      }

      return updated;
    });
  };

  const getCategoryCount = (category: 'physical' | 'mental' | 'spiritual') => {
    const list = quests[category];
    const done = list.filter((q) => q.completed).length;
    return `[${done}/${list.length}]`;
  };

  return (
    <div className="anime-window p-6 sm:p-8 max-w-lg mx-auto w-full relative">
      {/* Top Header: info icon + Title */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full border border-cyan-400/80 flex items-center justify-center text-cyan-300 text-xs">
          i
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text tracking-wide">
          {activeTab === 'overview' && 'Daily Quests'}
          {activeTab === 'physical' && 'PHYSICAL QUEST INFO'}
          {activeTab === 'mental' && 'MENTAL QUEST INFO'}
          {activeTab === 'spiritual' && 'SPIRITUAL QUEST INFO'}
        </h2>
      </div>

      {/* Subtitle Directive */}
      <div className="text-center font-mono text-xs italic text-gray-300 border-b border-cyan-500/20 pb-3 mb-5">
        [Daily Quest: Training has arrived.]
      </div>

      {/* Navigation tabs for categories */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => {
            systemSound.playClick();
            setActiveTab('overview');
          }}
          className={`px-3 py-1 text-xs font-mono border ${
            activeTab === 'overview'
              ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
              : 'border-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          OVERVIEW
        </button>
        <button
          onClick={() => {
            systemSound.playClick();
            setActiveTab('physical');
          }}
          className={`px-3 py-1 text-xs font-mono border ${
            activeTab === 'physical'
              ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
              : 'border-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          PHYSICAL
        </button>
        <button
          onClick={() => {
            systemSound.playClick();
            setActiveTab('mental');
          }}
          className={`px-3 py-1 text-xs font-mono border ${
            activeTab === 'mental'
              ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
              : 'border-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          MENTAL
        </button>
        <button
          onClick={() => {
            systemSound.playClick();
            setActiveTab('spiritual');
          }}
          className={`px-3 py-1 text-xs font-mono border ${
            activeTab === 'spiritual'
              ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
              : 'border-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          SPIRITUAL
        </button>
      </div>

      {/* GOAL Header */}
      <div className="text-center mb-5">
        <span className="font-mono text-sm font-bold text-white underline underline-offset-4 tracking-widest">
          GOAL
        </span>
      </div>

      {/* Content depending on tab */}
      {activeTab === 'overview' ? (
        <div className="space-y-4 font-mono text-sm max-w-sm mx-auto mb-6">
          <div
            onClick={() => setActiveTab('physical')}
            className="flex items-center justify-between p-2 hover:bg-cyan-500/10 cursor-pointer border border-transparent hover:border-cyan-500/30 transition-colors"
          >
            <span className="text-gray-200">Physical Training</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-300 font-bold">{getCategoryCount('physical')}</span>
              <div className="w-4 h-4 border border-cyan-400/60 rounded-sm bg-black/50" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('mental')}
            className="flex items-center justify-between p-2 hover:bg-cyan-500/10 cursor-pointer border border-transparent hover:border-cyan-500/30 transition-colors"
          >
            <span className="text-gray-200">Mental Training</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-300 font-bold">{getCategoryCount('mental')}</span>
              <div className="w-4 h-4 border border-cyan-400/60 rounded-sm bg-black/50" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('spiritual')}
            className="flex items-center justify-between p-2 hover:bg-cyan-500/10 cursor-pointer border border-transparent hover:border-cyan-500/30 transition-colors"
          >
            <span className="text-gray-200">Spiritual Training</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-300 font-bold">{getCategoryCount('spiritual')}</span>
              <div className="w-4 h-4 border border-cyan-400/60 rounded-sm bg-black/50" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 font-mono text-sm max-w-sm mx-auto mb-6">
          {quests[activeTab].map((q) => (
            <div
              key={q.id}
              onClick={() => toggleQuest(activeTab, q.id)}
              className="flex items-center justify-between p-2 hover:bg-cyan-500/10 cursor-pointer border border-cyan-500/10 hover:border-cyan-500/40 transition-colors"
            >
              <span className={q.completed ? 'text-gray-400 line-through' : 'text-gray-200'}>
                {q.label}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  [{q.targetCount} {q.unit}]
                </span>
                <div
                  className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-colors ${
                    q.completed
                      ? 'bg-cyan-400 border-cyan-400 text-black'
                      : 'border-cyan-400/60 bg-black/50'
                  }`}
                >
                  {q.completed && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warning: Penalty Notice */}
      <div className="text-center font-mono text-xs text-gray-400 border-t border-cyan-500/20 pt-4">
        <div>WARNING: Failure to complete the daily quest</div>
        <div>
          will result in an appropriate <span className="text-red-500 font-bold">penalty</span>
        </div>
      </div>
    </div>
  );
};
