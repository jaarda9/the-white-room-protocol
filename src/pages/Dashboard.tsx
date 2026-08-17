import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { SoloStatusWindow } from '@/components/SoloStatusWindow';
import { SoloDailyQuestWindow } from '@/components/SoloDailyQuestWindow';
import { SoloDungeonGates } from '@/components/SoloDungeonGates';
import AIChat from '@/components/AIChat';
import {
  acceptSuggestedToDo,
  completeToDo,
  getTodayKeyLocal,
  getToDos,
  ignoreSuggestedToDo,
  getUserProfile,
  getDailyQuests,
  saveUserProfile,
  addXP,
  QUESTS_UPDATED_EVENT,
  TODOS_UPDATED_EVENT,
} from '@/lib/storage';
import { UserProfile, Quest, ToDoItem } from '@/lib/types';
import { parseUserTodosFromInput } from '@/lib/todo-ai';
import { systemSound } from '@/lib/system-sound';
import {
  Sparkles, MessageSquare, Terminal, TestTube,
  Plus, Check, Flame, Clock, RefreshCw, Send, AlertCircle
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [todos, setTodos] = useState<ToDoItem[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [todoAiInput, setTodoAiInput] = useState('');
  const [todoAiBusy, setTodoAiBusy] = useState(false);
  const [todoAiHint, setTodoAiHint] = useState<string | null>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  useEffect(() => {
    let active = true;
    const loadQuests = async () => {
      try {
        const data = await getDailyQuests();
        if (!active) return;
        setQuests(data);
      } catch (error) {
        console.error('Failed to load quests', error);
      }
    };
    loadQuests();
    window.addEventListener(QUESTS_UPDATED_EVENT, loadQuests);
    return () => {
      active = false;
      window.removeEventListener(QUESTS_UPDATED_EVENT, loadQuests);
    };
  }, []);

  useEffect(() => {
    const load = () => setTodos(getToDos());
    load();
    window.addEventListener(TODOS_UPDATED_EVENT, load);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, load);
  }, []);

  const handleQuestComplete = (questId: string) => {
    const updated = quests.map((q) => {
      if (q.id === questId) {
        return { ...q, completed: true, completedAt: new Date().toISOString() };
      }
      return q;
    });
    setQuests(updated);

    const target = quests.find((q) => q.id === questId);
    if (target && profile) {
      const updatedProf = addXP(profile, target.xp);
      saveUserProfile(updatedProf);
      setProfile(updatedProf);
    }
  };

  const handleParseAiTodo = async () => {
    const text = todoAiInput.trim();
    if (!text) return;
    setTodoAiBusy(true);
    setTodoAiHint(null);
    try {
      const r = await parseUserTodosFromInput(text);
      if (r.created.length > 0) {
        setTodoAiInput('');
        setTodoAiHint(r.hint ?? `Added ${r.created.length} new objective(s).`);
        systemSound.playSystemChime();
      } else {
        setTodoAiHint(r.hint ?? 'No direct objectives detected.');
      }
    } catch (e) {
      setTodoAiHint(e instanceof Error ? e.message : 'Failed to parse input.');
    } finally {
      setTodoAiBusy(false);
    }
  };

  if (!profile) return null;

  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  const completedCount = quests.filter((q) => q.completed).length;

  return (
    <div className="min-h-screen bg-[#030712] text-foreground scanlines pb-16">
      {/* Top Solo Leveling System Bar */}
      <SoloLevelingHeader onOpenAIChat={() => setShowChat(!showChat)} />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        
        {/* System Hologram Header Alert */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-[#061026]/90 border border-primary/40 tech-corners shadow-[0_0_20px_rgba(0,240,255,0.15)]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <span className="font-display font-black text-xs sm:text-sm text-white tracking-widest system-glow-text">
              [ SYSTEM ALERT: HUNTER AWAKENING PROTOCOL INITIALIZED ]
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-primary/80">
            <span>HUNTER ID: {profile.pseudo}</span>
            <span className="hidden sm:inline">|</span>
            <span className="text-emerald-400">STATUS: ACTIVE</span>
          </div>
        </div>

        {/* Top Grid: Status Window + System Architect / Comms */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Status Window (Sung Jin-woo's Status HUD) */}
          <div className="lg:col-span-8">
            <SoloStatusWindow
              profile={profile}
              onProfileUpdated={(updated) => setProfile(updated)}
            />
          </div>

          {/* Side Panel: Architect Comms & System Terminal */}
          <div className="lg:col-span-4 space-y-4">
            <div className="system-window tech-corners p-4">
              <div className="flex items-center justify-between border-b border-primary/30 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                  <h3 className="font-display font-bold text-xs sm:text-sm text-white tracking-wider">
                    {showChat ? '[ THE ARCHITECT (AI) ]' : '[ SYSTEM LOGS ]'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    systemSound.playClick();
                    setShowChat(!showChat);
                  }}
                  className="text-xs font-mono px-2 py-0.5 border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-black transition-colors"
                >
                  {showChat ? '[ VIEW LOGS ]' : '[ TALK TO ARCHITECT ]'}
                </button>
              </div>

              {showChat ? (
                <div className="h-[420px]">
                  <AIChat
                    title="THE ARCHITECT"
                    placeholder="Ask the Architect to generate quests, adjust stats, or plan training..."
                  />
                </div>
              ) : (
                <div className="space-y-2.5 font-mono text-xs text-gray-300 min-h-[220px]">
                  <div className="p-2 bg-black/40 border border-primary/20">
                    <span className="text-primary font-bold">[{timeStr}]</span> System core synchronized with Hunter <span className="text-white font-bold">{profile.displayName || profile.pseudo}</span>.
                  </div>
                  <div className="p-2 bg-black/40 border border-primary/20">
                    <span className="text-primary font-bold">[{timeStr}]</span> Hunter Rank <span className="text-amber-300 font-bold">{profile.level >= 50 ? 'S-Rank' : `${profile.level}-Rank`}</span> verified. Current Level: <span className="text-primary font-bold">{profile.level}</span>.
                  </div>
                  <div className="p-2 bg-black/40 border border-primary/20">
                    <span className="text-primary font-bold">[{timeStr}]</span> Daily Protocol assigned: <span className="text-primary font-bold">{quests.length}</span> primary tasks active.
                  </div>
                  <div className="p-2 bg-black/40 border border-primary/20">
                    <span className="text-primary font-bold">[{timeStr}]</span> Completed: <span className="text-emerald-400 font-bold">{completedCount}/{quests.length}</span> objectives.
                  </div>

                  {/* AI Quick Task Input */}
                  <div className="pt-2 mt-2 border-t border-primary/20">
                    <span className="text-[11px] text-primary/80 font-tech block mb-1.5">
                      &gt; INPUT NEW PROTOCOL OBJECTIVE (AI PARSER):
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={todoAiInput}
                        onChange={(e) => setTodoAiInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleParseAiTodo();
                        }}
                        placeholder="e.g. '100 push-ups tomorrow and study physics'"
                        className="flex-1 bg-black/70 border border-primary/40 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={handleParseAiTodo}
                        disabled={todoAiBusy || !todoAiInput.trim()}
                        className="system-btn px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {todoAiBusy ? '...' : 'ADD'}
                      </button>
                    </div>
                    {todoAiHint && (
                      <span className="text-[10px] text-emerald-400 mt-1 block">
                        {todoAiHint}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Daily Quest Window (The Legendary Solo Leveling Daily Training) */}
        <SoloDailyQuestWindow
          quests={quests}
          todos={todos}
          profile={profile}
          onQuestComplete={handleQuestComplete}
        />

        {/* Section 3: Instance Dungeons & Training Gates */}
        <SoloDungeonGates profile={profile} />

        {/* Section 4: Bottom Quick Access & Integration Test */}
        <div className="p-3 bg-black/50 border border-primary/20 flex items-center justify-between text-xs font-mono text-gray-500">
          <button
            onClick={() => navigate('/chatgpt-test')}
            className="hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <TestTube className="w-3.5 h-3.5 text-primary" />
            <span>[ SYSTEM DIAGNOSTICS & INTEGRATION TESTS ]</span>
          </button>
          <span>THE SYSTEM v2.4 // PROTOCOL READY</span>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
