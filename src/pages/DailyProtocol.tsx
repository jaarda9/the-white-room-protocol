import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QuestCard } from '@/components/QuestCard';
import { getDailyQuests, QUESTS_UPDATED_EVENT } from '@/lib/storage';
import { Quest } from '@/lib/types';
import { ArrowLeft, Brain, Dumbbell, Moon } from 'lucide-react';

const CATEGORIES = [
  { key: 'mental', label: 'Mental Training', icon: Brain, types: ['mental'] },
  { key: 'physical', label: 'Physical Training', icon: Dumbbell, types: ['physical'] },
  { key: 'spiritual', label: 'Spiritual Training', icon: Moon, types: ['social'] },
] as const;

const isStudySessionQuest = (quest: Quest): boolean =>
  /^mental-study\d+-/.test(quest.id) || /^Study Session \d+/i.test(quest.title);

const getActiveQuest = (items: Quest[]): Quest | null => {
  if (items.length === 0) return null;
  const next = items.find((q) => !q.completed);
  return next ?? items[items.length - 1];
};

const countPhysicalSubtasks = (quest: Quest): number => {
  if (quest.type !== 'physical') return 1;
  const d = (quest.description || '').trim();
  if (!d) return 1;
  if (!d.includes('•')) return 1;
  return d.split('•').map((s) => s.trim()).filter(Boolean).length || 1;
};

const countCategoryUnits = (quests: Quest[], type: Quest['type']): { done: number; total: number } => {
  if (type !== 'physical') {
    const total = quests.length;
    const done = quests.filter((q) => q.completed).length;
    return { done, total };
  }
  const total = quests.reduce((sum, q) => sum + countPhysicalSubtasks(q), 0);
  const done = quests.reduce((sum, q) => sum + (q.completed ? countPhysicalSubtasks(q) : 0), 0);
  return { done, total };
};

const DailyProtocol = () => {
  const navigate = useNavigate();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [mentalVisibleQuest, setMentalVisibleQuest] = useState<Quest | null>(null);
  const [mentalAnim, setMentalAnim] = useState<'idle' | 'exit' | 'enter'>('idle');

  useEffect(() => {
    const load = async () => {
      try { setQuests(await getDailyQuests()); } catch {}
    };
    load();
    window.addEventListener(QUESTS_UPDATED_EVENT, load);
    return () => window.removeEventListener(QUESTS_UPDATED_EVENT, load);
  }, []);

  const studySessionQuests = useMemo(
    () => quests.filter((q) => q.type === 'mental' && isStudySessionQuest(q)),
    [quests],
  );

  useEffect(() => {
    const nextQuest = getActiveQuest(studySessionQuests);

    if (!mentalVisibleQuest) {
      setMentalVisibleQuest(nextQuest);
      return;
    }

    if (!nextQuest || nextQuest.id === mentalVisibleQuest.id) return;

    setMentalAnim('exit');
    const exitTimer = window.setTimeout(() => {
      setMentalVisibleQuest(nextQuest);
      setMentalAnim('enter');
      window.setTimeout(() => setMentalAnim('idle'), 220);
    }, 220);

    return () => window.clearTimeout(exitTimer);
  }, [studySessionQuests, mentalVisibleQuest]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Daily Protocol</h1>
            <p className="text-xs text-muted-foreground font-mono-data">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-3">
        {CATEGORIES.map(({ key, label, icon: Icon, types }) => {
          const categoryQuests = quests.filter(q => (types as readonly string[]).includes(q.type));
          const units = countCategoryUnits(categoryQuests, key === 'physical' ? 'physical' : (types[0] as Quest['type']));
          const done = units.done;
          const total = units.total;
          const isOpen = openCategory === key;

          return (
            <div key={key} className="border border-border bg-card rounded-sm overflow-hidden">
              <button
                onClick={() => setOpenCategory(isOpen ? null : key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-data text-sm">
                    {done}/{total}
                  </span>
                  {done >= total && total > 0 ? (
                    <span className="text-xs text-success font-mono-data">✓</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{isOpen ? '▲' : '▼'}</span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  {key === 'mental' ? (
                    <>
                      {categoryQuests
                        .filter((quest) => !isStudySessionQuest(quest))
                        .map((quest) => (
                          <QuestCard
                            key={quest.id}
                            quest={quest}
                            onStart={(q) => navigate(`/quest/${q.id}`)}
                          />
                        ))}
                      {mentalVisibleQuest && (
                        <div
                          className={`transition-all duration-200 ${
                            mentalAnim === 'exit'
                              ? 'opacity-0 translate-x-4'
                              : mentalAnim === 'enter'
                                ? 'opacity-0 -translate-x-2 animate-in fade-in slide-in-from-left-2 duration-200'
                                : 'opacity-100 translate-x-0'
                          }`}
                        >
                          <QuestCard
                            key={mentalVisibleQuest.id}
                            quest={mentalVisibleQuest}
                            onStart={(q) => navigate(`/quest/${q.id}`)}
                          />
                        </div>
                      )}
                      {categoryQuests.length === 0 && (
                        <div className="text-xs text-muted-foreground font-mono-data">
                          No mental tasks assigned.
                        </div>
                      )}
                    </>
                  ) : (
                    categoryQuests.map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        onStart={(q) => navigate(`/quest/${q.id}`)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyProtocol;
