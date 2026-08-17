import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Quest, ToDoItem, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { completeToDo, addXP, getUserProfile, saveUserProfile } from '@/lib/storage';
import {
  Dumbbell, AlertTriangle, CheckCircle2, Clock, 
  Gift, ChevronRight, Play, Plus, Sparkles, Brain, Check,
  Flame, ListTodo
} from 'lucide-react';

interface Props {
  quests: Quest[];
  todos: ToDoItem[];
  profile: UserProfile;
  onQuestComplete?: (questId: string) => void;
}

export const SoloDailyQuestWindow = ({ quests, todos, profile, onQuestComplete }: Props) => {
  const navigate = useNavigate();
  const [timeRemaining, setTimeRemaining] = useState<string>('00:00:00');
  const [activeTab, setActiveTab] = useState<'all' | 'physical' | 'mental' | 'todos'>('all');

  // Calculate live countdown to 00:00:00 local midnight
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeRemaining('00:00:00 [RESET DUE]');
        return;
      }

      const hrs = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const completedQuestsCount = quests.filter((q) => q.completed).length;
  const activeTodos = todos.filter((t) => t.status === 'active' || t.status === 'suggested');
  const completedTodos = todos.filter((t) => t.status === 'completed');

  const totalTasks = quests.length + activeTodos.length + completedTodos.length;
  const doneTasks = completedQuestsCount + completedTodos.length;
  const overallProgressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  const handleStartQuest = (questId: string) => {
    systemSound.playClick();
    navigate(`/quest/${questId}`);
  };

  const handleCompleteTaskDirect = (quest: Quest) => {
    systemSound.playQuestComplete();
    if (onQuestComplete) {
      onQuestComplete(quest.id);
    }
  };

  const handleCompleteTodo = (todoId: string) => {
    systemSound.playQuestComplete();
    completeToDo(todoId);
  };

  return (
    <div className="system-window tech-corners p-5 sm:p-6 w-full relative overflow-hidden">
      {/* Top Hologram Bracketed Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/40 pb-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-primary animate-ping" />
            <h2 className="text-lg sm:text-2xl font-display font-black tracking-widest text-white system-glow-text">
              [ QUEST INFO: PREPARING TO BECOME STRONG ]
            </h2>
          </div>
          <p className="text-xs font-tech text-primary/80 tracking-wider mt-0.5">
            [ GOAL: COMPLETE ALL DAILY PHYSICAL, MENTAL & PROTOCOL TASKS ]
          </p>
        </div>

        {/* Live Penalty Countdown Clock */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/40 border border-red-500/60 shadow-[0_0_15px_rgba(255,0,85,0.3)] animate-penalty-pulse">
          <Clock className="w-4 h-4 text-red-400" />
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-red-300 font-bold uppercase tracking-widest">
              TIME REMAINING
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-red-400 tracking-wider">
              {timeRemaining}
            </span>
          </div>
        </div>
      </div>

      {/* Daily Progress Gauge */}
      <div className="mb-5 bg-black/40 p-3.5 border border-primary/30">
        <div className="flex justify-between items-center text-xs font-mono mb-1.5">
          <span className="text-white font-tech font-bold tracking-wider">
            DAILY COMPLETION RATE
          </span>
          <span className="text-primary font-bold">
            {doneTasks} / {totalTasks} ({overallProgressPct.toFixed(0)}%)
          </span>
        </div>
        <div className="h-3 bg-black/80 border border-primary/40 p-0.5 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-primary shadow-[0_0_15px_rgba(0,240,255,0.9)] transition-all duration-500"
            style={{ width: `${Math.max(2, overallProgressPct)}%` }}
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 text-xs font-display font-bold">
        {[
          { key: 'all', label: '[ ALL PROTOCOLS ]' },
          { key: 'physical', label: '[ PHYSICAL TRAINING ]' },
          { key: 'mental', label: '[ MENTAL FOCUS ]' },
          { key: 'todos', label: `[ SYSTEM TO-DOS (${activeTodos.length}) ]` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              systemSound.playClick();
              setActiveTab(tab.key as any);
            }}
            className={`px-3 py-1.5 border transition-all whitespace-nowrap ${activeTab === tab.key ? 'border-primary bg-primary/20 text-primary system-glow-text shadow-[0_0_12px_rgba(0,240,255,0.3)]' : 'border-gray-800 bg-black/40 text-gray-400 hover:border-primary/40 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quests & Tasks List */}
      <div className="space-y-3 mb-6">
        {quests
          .filter((q) => {
            if (activeTab === 'physical') return q.type === 'physical';
            if (activeTab === 'mental') return q.type === 'mental';
            if (activeTab === 'todos') return false;
            return true;
          })
          .map((quest) => {
            const isCompleted = quest.completed;
            return (
              <div
                key={quest.id}
                className={`p-4 border transition-all ${isCompleted ? 'border-emerald-500/40 bg-emerald-950/20 opacity-80' : 'border-primary/30 bg-[#060e24]/80 hover:border-primary/60 shadow-[0_0_10px_rgba(0,240,255,0.06)]'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 border mt-0.5 ${isCompleted ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-primary/50 bg-primary/10 text-primary'}`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : quest.type === 'physical' ? <Dumbbell className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 border ${isCompleted ? 'border-emerald-500/50 text-emerald-300' : 'border-primary/50 text-primary'}`}>
                          {quest.type.toUpperCase()}
                        </span>
                        <h4 className={`text-sm sm:text-base font-display font-bold tracking-wider ${isCompleted ? 'text-emerald-300 line-through' : 'text-white'}`}>
                          {quest.title}
                        </h4>
                      </div>

                      <p className="text-xs font-tech text-gray-400 mt-1 whitespace-pre-line">
                        {quest.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-muted-foreground">
                        <span className="text-primary/90 font-bold">+{quest.xp} EXP</span>
                        <span>DURATION: {quest.duration} MIN</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isCompleted ? (
                      <span className="px-3 py-1 border border-emerald-500/60 bg-emerald-950/40 text-emerald-400 font-mono text-xs font-bold tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        COMPLETED
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartQuest(quest.id)}
                        className="system-btn px-3.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-primary"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        EXECUTE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        {/* To-Dos Section (When activeTab is 'all' or 'todos') */}
        {(activeTab === 'all' || activeTab === 'todos') && (
          <div className="space-y-2 pt-2">
            {activeTodos.length > 0 && (
              <div className="text-[11px] font-mono text-primary/80 border-b border-primary/20 pb-1 flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-primary" />
                SYSTEM OBJECTIVES / TO-DOS
              </div>
            )}

            {activeTodos.map((todo) => (
              <div
                key={todo.id}
                className="p-3 border border-primary/25 bg-[#050c1e] flex items-center justify-between gap-3 hover:border-primary/50"
              >
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleCompleteTodo(todo.id)}
                    title="Mark task completed"
                    className="w-5 h-5 border border-primary/60 bg-primary/10 hover:bg-primary hover:text-black flex items-center justify-center text-primary transition-colors"
                  >
                    <Check className="w-3 h-3 opacity-0 hover:opacity-100" />
                  </button>
                  <div>
                    <span className="text-xs sm:text-sm font-tech font-bold text-white">
                      {todo.title}
                    </span>
                    {todo.notes && (
                      <p className="text-[11px] text-gray-400 font-mono line-clamp-1">
                        {todo.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-amber-400 border border-amber-500/40 px-1.5 py-0.2">
                    +{todo.xp} EXP
                  </span>
                  <button
                    onClick={() => handleCompleteTodo(todo.id)}
                    className="system-btn px-2 py-1 text-[10px]"
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning Box (The Famous Solo Leveling Penalty Warning) */}
      <div className="p-3.5 mb-5 bg-red-950/30 border border-red-500/60 shadow-[0_0_15px_rgba(255,0,85,0.15)] flex items-start gap-3 text-xs font-mono">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <span className="text-red-400 font-bold font-tech text-sm tracking-wider block">
            ※ CAUTION: PENALTY QUEST DIRECTIVE
          </span>
          <p className="text-red-300/90 text-[11px] mt-0.5">
            Failure to complete the daily conditioning protocol before 00:00 will trigger an automatic transfer to the Penalty Zone for a 4-hour survival challenge.
          </p>
        </div>
      </div>

      {/* Rewards Box */}
      <div className="bg-[#051128] border border-primary/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs sm:text-sm font-display font-black tracking-wider text-white">
            [ DAILY QUEST REWARDS ]
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-black/50 border border-emerald-500/40 text-emerald-300">
            <div className="font-bold text-[11px] text-emerald-400 mb-0.5">REWARD 01</div>
            <div>Full Status Recovery (Fatigue Reset)</div>
          </div>

          <div className="p-2.5 bg-black/50 border border-amber-500/40 text-amber-300">
            <div className="font-bold text-[11px] text-amber-400 mb-0.5">REWARD 02</div>
            <div>+3 Stat Points (AP)</div>
          </div>

          <div className="p-2.5 bg-black/50 border border-purple-500/40 text-purple-300">
            <div className="font-bold text-[11px] text-purple-400 mb-0.5">REWARD 03</div>
            <div>Random Loot Box / Skill Scroll</div>
          </div>
        </div>
      </div>
    </div>
  );
};
