import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/lib/types';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { ArrowLeft, CheckCircle2, Circle, Eye, MessageSquare, Shield, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { systemSound } from '@/lib/system-sound';

interface SocialChallenge {
  id: string;
  title: string;
  description: string;
  category: 'observation' | 'interaction' | 'influence' | 'defense';
  difficulty: 1 | 2 | 3;
  xp: number;
  completed: boolean;
}

const DAILY_CHALLENGES: SocialChallenge[] = [
  {
    id: 'obs-1',
    title: 'Perception Scan: Read the Room',
    description: 'In your next group interaction, identify the dominant person and the most reserved. Note subtle body language shifts.',
    category: 'observation',
    difficulty: 1,
    xp: 25,
    completed: false,
  },
  {
    id: 'obs-2',
    title: 'Micro-Expression Detection',
    description: 'During a conversation, catch one moment where someone\'s face briefly shows an emotion different from their spoken words.',
    category: 'observation',
    difficulty: 2,
    xp: 40,
    completed: false,
  },
  {
    id: 'int-1',
    title: 'Tactical Mirroring',
    description: 'In one conversation today, use the mirroring technique: repeat back the last 3 key words they said as an inquiry.',
    category: 'interaction',
    difficulty: 1,
    xp: 25,
    completed: false,
  },
  {
    id: 'int-2',
    title: 'Cold Approach Infiltration',
    description: 'Initiate a dialogue with an unfamiliar individual. Extract one piece of genuine intelligence regarding their interests.',
    category: 'interaction',
    difficulty: 2,
    xp: 50,
    completed: false,
  },
  {
    id: 'inf-1',
    title: 'Reciprocity Trigger',
    description: 'Execute an unexpected favor without demanding compensation. Observe social leverage calibration.',
    category: 'influence',
    difficulty: 1,
    xp: 30,
    completed: false,
  },
  {
    id: 'def-1',
    title: 'Cognitive Pressure Immunity',
    description: 'When pressured for a fast commitment, deliberately deploy a 5-second pause followed by "I will evaluate it first".',
    category: 'defense',
    difficulty: 1,
    xp: 25,
    completed: false,
  },
];

export default function SocialLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [challenges, setChallenges] = useState<SocialChallenge[]>([]);

  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);

    const savedData = localStorage.getItem('social-challenges');
    const today = new Date().toDateString();
    if (savedData) {
      try {
        const { date, data } = JSON.parse(savedData);
        if (date === today) {
          setChallenges(data);
          return;
        }
      } catch (e) {}
    }
    setChallenges(DAILY_CHALLENGES);
  }, []);

  const handleComplete = async (challengeId: string) => {
    if (!profile) return;
    const ch = challenges.find((c) => c.id === challengeId);
    if (!ch || ch.completed) return;

    systemSound.playLevelUp();
    const updated = challenges.map((c) => (c.id === challengeId ? { ...c, completed: true } : c));
    setChallenges(updated);
    localStorage.setItem(
      'social-challenges',
      JSON.stringify({
        date: new Date().toDateString(),
        data: updated,
      })
    );

    const nextProf = addXP(profile, ch.xp);
    saveUserProfile(nextProf);
    setProfile(nextProf);

    toast({
      title: 'Protocol Executed',
      description: `+${ch.xp} EXP logged to Hunter Record!`,
    });
  };

  const completedCount = challenges.filter((c) => c.completed).length;

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

          <span className="text-xs font-mono border border-cyan-500/40 px-2 py-0.5 text-cyan-300">
            COMPLETED: {completedCount}/{challenges.length}
          </span>
        </div>

        <div className="anime-window p-6 text-center">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
            SOCIAL DYNAMICS & PERCEPTION LAB
          </h1>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Interpersonal perception conditioning, persuasion mechanics, and social defense protocols.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 font-mono text-xs">
          {challenges.map((ch) => (
            <div
              key={ch.id}
              className={`anime-window p-5 flex flex-col justify-between space-y-3 transition-all ${
                ch.completed ? 'border-cyan-400 bg-cyan-950/20 opacity-80' : 'hover:border-cyan-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase border border-cyan-500/30 px-1.5 py-0.2 text-cyan-300">
                    {ch.category}
                  </span>
                  <span className="text-cyan-300 font-bold">+{ch.xp} EXP</span>
                </div>
                <h3 className={`font-bold text-sm ${ch.completed ? 'text-cyan-300' : 'text-white'}`}>
                  {ch.title}
                </h3>
                <p className="text-gray-400 text-[11px] mt-1 leading-relaxed">
                  {ch.description}
                </p>
              </div>

              <button
                disabled={ch.completed}
                onClick={() => handleComplete(ch.id)}
                className={`w-full py-2 flex items-center justify-center gap-1.5 font-bold transition-all ${
                  ch.completed
                    ? 'border border-cyan-500/40 text-cyan-400 bg-transparent'
                    : 'bg-cyan-400 text-black hover:bg-cyan-300'
                }`}
              >
                {ch.completed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>LOGGED COMPLETE</span>
                  </>
                ) : (
                  <span>LOG MISSION EXECUTION</span>
                )}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
