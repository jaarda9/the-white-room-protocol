import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestCard } from '@/components/QuestCard';
import {
  acceptSuggestedToDo,
  completeToDo,
  getDailyQuests,
  getTodayKeyLocal,
  getToDos,
  ignoreSuggestedToDo,
  TODOS_UPDATED_EVENT,
  QUESTS_UPDATED_EVENT,
} from '@/lib/storage';
import { Quest } from '@/lib/types';
import { ArrowLeft, Brain, Dumbbell, Moon, ListChecks, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { systemSound } from '@/lib/system-sound';
import type { ToDoItem } from '@/lib/types';

const CATEGORIES = [
  { key: 'physical', label: 'PHYSICAL CONDITIONING', icon: Dumbbell, types: ['physical'] },
  { key: 'mental', label: 'INTELLECT & REASONING', icon: Brain, types: ['mental'] },
  { key: 'spiritual', label: 'MEDITATION & DISCIPLINE', icon: Moon, types: ['social'] },
  { key: 'todos', label: 'TACTICAL TO-DO LIST', icon: ListChecks, types: [] },
] as const;

export default function DailyProtocol() {
  const navigate = useNavigate();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>('physical');
  const [todos, setTodos] = useState<ToDoItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try { setQuests(await getDailyQuests()); } catch {}
    };
    load();
    window.addEventListener(QUESTS_UPDATED_EVENT, load);
    return () => window.removeEventListener(QUESTS_UPDATED_EVENT, load);
  }, []);

  useEffect(() => {
    const load = () => setTodos(getToDos());
    load();
    window.addEventListener(TODOS_UPDATED_EVENT, load);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, load);
  }, []);

  const todayKey = useMemo(() => getTodayKeyLocal(new Date()), []);

  const todaysToDos = useMemo(
    () => todos.filter((t) => t.dueDate === todayKey && (t.status === 'active' || t.status === 'completed')),
    [todos, todayKey]
  );

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
        </div>

        <div className="anime-window p-6 text-center">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
            DAILY HUNTER PROTOCOL
          </h1>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Mandatory daily training missions. Complete all directives to prevent penalty zone triggers.
          </p>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {CATEGORIES.map(({ key, label, icon: Icon, types }) => {
            const categoryQuests = quests.filter((q) => (types as readonly string[]).includes(q.type));
            const done = categoryQuests.filter((q) => q.completed).length;
            const total = categoryQuests.length;
            const isOpen = openCategory === key;
            const isToDos = key === 'todos';
            const todoDone = todaysToDos.filter((t) => t.status === 'completed').length;
            const todoTotal = todaysToDos.length;

            return (
              <div key={key} className="anime-window overflow-hidden">
                <button
                  onClick={() => {
                    systemSound.playClick();
                    setOpenCategory(isOpen ? null : key);
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-cyan-400" />
                    <span className="font-bold text-white tracking-wider text-xs sm:text-sm">{label}</span>
                  </div>

                  <div className="flex items-center gap-3 text-cyan-300">
                    <span className="border border-cyan-500/30 px-2 py-0.5">
                      {isToDos ? `${todoDone}/${todoTotal}` : `${done}/${total}`}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="p-4 border-t border-cyan-500/20 bg-black/30 space-y-3">
                    {isToDos ? (
                      <div className="space-y-2">
                        {todaysToDos.length === 0 ? (
                          <div className="text-gray-500 text-center py-4">
                            No custom to-do tasks logged for today.
                          </div>
                        ) : (
                          todaysToDos.map((t) => (
                            <div
                              key={t.id}
                              className="p-3 border border-cyan-500/30 bg-black/40 flex items-center justify-between"
                            >
                              <div className={t.status === 'completed' ? 'line-through text-gray-500' : 'text-white'}>
                                {t.title}
                              </div>
                              {t.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                              ) : (
                                <button
                                  onClick={() => {
                                    systemSound.playClick();
                                    completeToDo(t.id);
                                  }}
                                  className="px-2.5 py-1 bg-cyan-400 text-black font-bold hover:bg-cyan-300"
                                >
                                  COMPLETE
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {categoryQuests.map((quest) => (
                          <QuestCard
                            key={quest.id}
                            quest={quest}
                            onStart={(q) => navigate(`/quest/${q.id}`)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
