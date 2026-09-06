import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDailyQuests,
  toggleQuestCompletion,
  getUserProfile,
  saveUserProfile,
  addXP,
  QUESTS_UPDATED_EVENT,
} from '@/lib/storage';
import { Quest, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  Sparkles,
  Play,
  Check,
  RotateCcw,
  Clock,
  ExternalLink,
  Moon,
  Sun,
  Dumbbell,
  Brain,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailySpiritualLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [quests, setQuests] = useState<Quest[]>([]);

  // Bead counter state
  const [beadCount, setBeadCount] = useState<number>(0);
  const [reflectionNote, setReflectionNote] = useState<string>('');

  // Medito & Contemplation Timer state
  const [meditationMinutes, setMeditationMinutes] = useState(10);
  const [meditationTimeRemaining, setMeditationTimeRemaining] = useState(10 * 60);
  const [meditationActive, setMeditationActive] = useState(false);
  const meditationEndRef = useRef<number | null>(null);

  const todayKey = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    try {
      const q = await getDailyQuests();
      setQuests(q);
      setProfile(getUserProfile());
    } catch (e) {
      console.error('Failed to load quests in DailySpiritualLab:', e);
    }
  };

  useEffect(() => {
    loadData();

    // Load saved reflection for today
    try {
      const saved = localStorage.getItem(`wrp:reflection:${todayKey}`);
      if (saved) setReflectionNote(saved);
    } catch {
      // non-fatal
    }

    const handleUpdate = () => loadData();
    window.addEventListener(QUESTS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('wrp:profile-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(QUESTS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('wrp:profile-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [todayKey]);

  const spiritualQuests = useMemo(
    () => quests.filter((q) => q.type === 'social' || q.id.startsWith('spiritual')),
    [quests]
  );

  const completedCount = spiritualQuests.filter((q) => q.completed).length;

  // Contemplation timer effect
  useEffect(() => {
    if (!meditationActive) return;

    const interval = setInterval(() => {
      if (!meditationEndRef.current) return;
      const remaining = Math.max(0, Math.ceil((meditationEndRef.current - Date.now()) / 1000));
      setMeditationTimeRemaining(remaining);

      if (remaining === 0) {
        setMeditationActive(false);
        meditationEndRef.current = null;
        systemSound.playLevelUp();
        toast.success('CONTEMPLATION PROTOCOL CONCLUDED', {
          description: 'Mindfulness session verified. Record any reflection notes.',
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [meditationActive]);

  const startMeditation = (mins: number) => {
    systemSound.playSystemChime();
    setMeditationMinutes(mins);
    setMeditationTimeRemaining(mins * 60);
    meditationEndRef.current = Date.now() + mins * 60 * 1000;
    setMeditationActive(true);
  };

  const pauseMeditation = () => {
    systemSound.playClick();
    setMeditationActive(false);
    meditationEndRef.current = null;
  };

  const resetMeditation = () => {
    systemSound.playClick();
    setMeditationActive(false);
    meditationEndRef.current = null;
    setMeditationTimeRemaining(meditationMinutes * 60);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Smart Medito handoff logic (as described in links.txt)
  const handleOpenMedito = () => {
    systemSound.playClick();
    toast.info('LAUNCHING MEDITO MINDFULNESS HANDOFF', {
      description: 'Attempting native app handoff. Return to debrief upon completion.',
    });

    const appProtocol = 'medito://';
    const fallbackWeb = 'https://meditofoundation.org';

    // Try custom protocol with fallback timeout
    const start = Date.now();
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appProtocol;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
      // If user still in document within 1.5s, app probably not installed -> open web fallback
      if (Date.now() - start < 2000) {
        window.open(fallbackWeb, '_blank', 'noopener,noreferrer');
      }
    }, 1200);
  };

  const handleSaveReflection = () => {
    systemSound.playClick();
    try {
      localStorage.setItem(`wrp:reflection:${todayKey}`, reflectionNote);
      toast.success('CONTEMPLATION LOG SAVED', {
        description: 'Daily reflection synchronized with hunter archive.',
      });
    } catch {
      // non-fatal
    }
  };

  const handleToggleQuest = (questId: string) => {
    systemSound.playClick();
    const updated = toggleQuestCompletion(questId);
    setQuests(updated);

    const target = updated.find((q) => q.id === questId);
    if (target?.completed) {
      systemSound.playQuestComplete();
      const updatedProfile = addXP(profile, target.xp);
      saveUserProfile(updatedProfile);
      setProfile(updatedProfile);
      toast.success('SPIRITUAL OBJECTIVE COMPLETE', {
        description: `+${target.xp} EXP acquired for Hunter ${profile.displayName || profile.pseudo}.`,
      });
    }
  };

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[660px] w-full mx-auto px-4 py-6 flex-1 flex flex-col items-center">
        {/* Solo Leveling Holographic Container */}
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono space-y-5">
          {/* Top Controls */}
          <div className="flex items-center justify-between pb-2 border-b border-white/20 text-xs">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol');
              }}
              className="flex items-center gap-1.5 text-cyan-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO ALL DAILY QUESTS ]</span>
            </button>

            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/');
              }}
              className="text-white/60 hover:text-cyan-300 transition-colors"
            >
              [ STATUS ]
            </button>
          </div>

          {/* Quick Lab Switcher Tabs */}
          <div className="grid grid-cols-4 gap-1.5 text-[10px] sm:text-xs">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol');
              }}
              className="py-1.5 px-2 border border-white/30 bg-[#061424]/90 hover:bg-white/10 text-white/70 text-center transition-all rounded-[2px]"
            >
              [ ALL ]
            </button>
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol/physical');
              }}
              className="py-1.5 px-2 border border-white/30 bg-[#061424]/90 hover:bg-white/10 text-white/70 text-center transition-all rounded-[2px]"
            >
              [ PHYSICAL ]
            </button>
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol/mental');
              }}
              className="py-1.5 px-2 border border-white/30 bg-[#061424]/90 hover:bg-white/10 text-white/70 text-center transition-all rounded-[2px]"
            >
              [ MENTAL ]
            </button>
            <button
              className="py-1.5 px-2 border-2 border-cyan-400 bg-cyan-950/60 text-cyan-300 font-bold text-center shadow-[0_0_10px_rgba(0,212,255,0.25)] rounded-[2px]"
            >
              [ SPIRITUAL ]
            </button>
          </div>

          {/* Header Title in Solo Leveling System Frame */}
          <div className="text-center">
            <div className="inline-block px-8 py-1.5 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <h1 className="font-mono font-extrabold tracking-[0.22em] text-sm sm:text-base text-white anime-glow-text uppercase">
                [ DAILY PROTOCOL: SPIRITUAL LAB ]
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-white/80 mt-2">
              TARGET: SPIRITUAL ALIGNMENT • MINDFULNESS & INTROSPECTION
            </p>
          </div>

          {/* Progress Header */}
          <div className="flex items-center justify-between p-3 border border-white/30 bg-[#061424]/80 rounded-[2px] text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              DAILY SPIRITUAL PROTOCOLS
            </span>
            <span className={`font-bold ${completedCount === spiritualQuests.length && spiritualQuests.length > 0 ? 'text-emerald-400' : 'text-cyan-300'}`}>
              [{completedCount} / {spiritualQuests.length} COMPLETED]
            </span>
          </div>

          {/* List of Spiritual Daily Quests */}
          <div className="space-y-2.5">
            {spiritualQuests.map((quest) => (
              <div
                key={quest.id}
                className={`p-3.5 border rounded-[2px] transition-all ${
                  quest.completed
                    ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                    : 'border-white/30 bg-[#061424]/80 hover:border-cyan-400/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {quest.title.toLowerCase().includes('morning') ? (
                        <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      ) : quest.title.toLowerCase().includes('evening') || quest.title.toLowerCase().includes('witr') ? (
                        <Moon className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      <h3 className={`text-xs sm:text-sm font-bold truncate ${quest.completed ? 'text-emerald-300 line-through' : 'text-white'}`}>
                        {quest.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      {quest.description}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-[#9fd3ff]">
                      <span>{quest.duration} MIN</span>
                      <span>•</span>
                      <span>+{quest.xp} EXP</span>
                      <span>•</span>
                      <span>RANK {quest.difficulty}</span>
                    </div>
                  </div>

                  {/* Play & Checkbox */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <button
                      onClick={() => {
                        systemSound.playClick();
                        navigate(`/quest/${quest.id}`);
                      }}
                      className="p-2 border border-white/40 bg-white/5 hover:border-cyan-300 hover:bg-cyan-950/40 text-cyan-300 transition-all rounded-[2px]"
                      title="Launch contemplation session"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    <button
                      onClick={() => handleToggleQuest(quest.id)}
                      className={`w-7 h-7 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                        quest.completed
                          ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                          : 'border-white/50 bg-black/50 hover:border-cyan-300'
                      }`}
                      title={quest.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {quest.completed && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Medito Universal Link Integration (from links.txt) */}
          <div className="p-4 border border-cyan-400/50 bg-cyan-950/30 rounded-[2px] space-y-3 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                [ MEDITO & MINDFULNESS HANDOFF ]
              </span>
              <span className="text-[10px] text-cyan-300 font-mono">UNIVERSAL APP PROTOCOL</span>
            </div>

            <p className="text-[11px] text-gray-300 leading-relaxed">
              Launch Medito directly via OS app protocol for guided meditation, or use our in-system contemplation timer below.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleOpenMedito}
                className="flex-1 py-2.5 px-3 border border-cyan-400 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 rounded-[2px] shadow-[0_0_10px_rgba(0,212,255,0.2)] transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                [ OPEN MEDITO APP ]
              </button>

              <button
                onClick={() => startMeditation(10)}
                className="py-2.5 px-3 border border-white/40 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-[2px] flex items-center justify-center gap-1.5 transition-all"
              >
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                [ SYSTEM TIMER (10M) ]
              </button>
            </div>

            {/* In-system timer display if active */}
            {meditationActive && (
              <div className="pt-2 text-center border-t border-white/20 space-y-2">
                <div className="text-3xl font-black text-cyan-300 font-mono anime-glow-text">
                  {formatTimer(meditationTimeRemaining)}
                </div>
                <div className="flex justify-center gap-2 text-xs">
                  <button
                    onClick={pauseMeditation}
                    className="px-3 py-1 border border-amber-400 text-amber-300 rounded-[2px]"
                  >
                    PAUSE
                  </button>
                  <button
                    onClick={resetMeditation}
                    className="px-3 py-1 border border-white/40 text-gray-300 rounded-[2px]"
                  >
                    RESET
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Contemplation Bead / Tasbih Counter */}
          <div className="p-4 border border-white/30 bg-[#061424]/80 rounded-[2px] space-y-4">
            <div className="flex items-center justify-between border-b border-white/20 pb-2 text-xs">
              <span className="font-bold text-white tracking-wider">
                [ CONTEMPLATION & REPETITION COUNTER ]
              </span>
              <span className="text-cyan-300 font-bold">COUNT: {beadCount}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-1">
              <button
                onClick={() => {
                  systemSound.playClick();
                  setBeadCount((c) => c + 1);
                }}
                className="w-24 h-24 rounded-full border-2 border-cyan-400 bg-cyan-950/50 hover:bg-cyan-900/70 active:scale-95 transition-all flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.25)] text-center cursor-pointer"
              >
                <span className="text-2xl font-black text-white font-mono">{beadCount}</span>
                <span className="text-[8px] text-cyan-300 font-bold uppercase tracking-widest mt-1">TAP COUNT</span>
              </button>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      systemSound.playClick();
                      setBeadCount((c) => c + 33);
                    }}
                    className="px-3 py-1.5 border border-white/30 bg-white/5 hover:bg-white/10 text-xs text-white rounded-[2px]"
                  >
                    +33
                  </button>
                  <button
                    onClick={() => {
                      systemSound.playClick();
                      setBeadCount((c) => c + 100);
                    }}
                    className="px-3 py-1.5 border border-white/30 bg-white/5 hover:bg-white/10 text-xs text-white rounded-[2px]"
                  >
                    +100
                  </button>
                  <button
                    onClick={() => {
                      systemSound.playClick();
                      setBeadCount(0);
                    }}
                    className="px-3 py-1.5 border border-red-500/40 bg-red-950/20 text-xs text-red-300 hover:bg-red-900/30 flex items-center gap-1 rounded-[2px]"
                  >
                    <RotateCcw className="w-3 h-3" /> RESET
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    value={reflectionNote}
                    onChange={(e) => setReflectionNote(e.target.value)}
                    placeholder="Contemplation or reflection note..."
                    className="bg-black/60 border border-white/30 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 outline-none rounded-[2px] flex-1"
                  />
                  <button
                    onClick={handleSaveReflection}
                    className="px-2.5 py-1.5 border border-white/40 bg-white/10 hover:bg-white/20 text-xs text-white rounded-[2px]"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* System Footer Note */}
          <div className="p-3 border border-white/20 bg-black/40 text-[11px] text-gray-400 leading-relaxed">
            <span className="text-cyan-300 font-bold block mb-0.5">※ SYSTEM NOTICE:</span>
            Spiritual and contemplation protocols reinforce Wisdom (WIS) and Perception (PER). Consistent morning and evening routines maintain Hunter mental stability against high-fatigue dungeons.
          </div>
        </div>
      </main>
    </div>
  );
}
