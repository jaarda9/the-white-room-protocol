import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import {
  loadOrGenerateNutritionPlan,
  generateNutritionPlan,
  getNutritionLog,
  saveNutritionLog,
  getTodayKey,
  type NutritionPlan,
  type NutritionLog,
} from '@/lib/nutrition-lab';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  Info,
  UtensilsCrossed,
  Check,
  Droplets,
  RefreshCw,
  Flame,
  Beef,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailyNutritionLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [log, setLog] = useState<NutritionLog>(() => getNutritionLog());
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const todayKey = useMemo(() => getTodayKey(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = getUserProfile();
      setProfile(p);
      const nextPlan = await loadOrGenerateNutritionPlan(p);
      setPlan(nextPlan);
      setLog(getNutritionLog(nextPlan.date));
    } catch (e) {
      console.error('Failed to load nutrition protocol:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persistLog = (next: NutritionLog) => {
    setLog(next);
    saveNutritionLog(next);
  };

  const toggleMeal = (id: string) => {
    systemSound.playClick();
    const done = log.mealsDone.includes(id);
    persistLog({
      ...log,
      mealsDone: done ? log.mealsDone.filter((m) => m !== id) : [...log.mealsDone, id],
    });
  };

  const toggleWater = () => {
    systemSound.playClick();
    persistLog({ ...log, waterDone: !log.waterDone });
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    systemSound.playClick();
    setRegenerating(true);
    try {
      const fresh = await generateNutritionPlan(profile);
      setPlan(fresh);
      persistLog({ date: fresh.date, mealsDone: [], waterDone: false, claimed: false });
      toast.success('DIET PROTOCOL REISSUED');
    } finally {
      setRegenerating(false);
    }
  };

  const mealsDone = plan ? plan.meals.filter((m) => log.mealsDone.includes(m.id)).length : 0;
  const mealsTotal = plan?.meals.length ?? 0;
  const allDone = mealsTotal > 0 && mealsDone === mealsTotal && log.waterDone;

  const consumed = plan
    ? plan.meals
        .filter((m) => log.mealsDone.includes(m.id))
        .reduce(
          (acc, m) => ({ calories: acc.calories + m.calories, protein: acc.protein + m.protein }),
          { calories: 0, protein: 0 }
        )
    : { calories: 0, protein: 0 };

  const handleClaim = () => {
    if (!allDone || log.claimed) {
      systemSound.playClick();
      return;
    }
    systemSound.playLevelUp();
    const updated = addXP(profile, 80, 'physical');
    saveUserProfile(updated);
    setProfile(updated);
    persistLog({ ...log, claimed: true });
    toast.success('DIET PROTOCOL FULFILLED', {
      description: '+80 EXP acquired. Recovery capacity reinforced.',
    });
  };

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[620px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
          {/* Header controls */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/20 text-xs gap-2 flex-wrap">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol');
              }}
              className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO ALL QUESTS ]</span>
            </button>
            <div className="text-[11px] text-cyan-300/80 font-bold tracking-wider">
              TOTAL: [{mealsDone}/{mealsTotal}]
            </div>
          </div>

          {/* Title plate */}
          <div className="relative flex items-center justify-center pb-2 mb-2">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#9fd3ff]" />
                <span className="font-mono font-extrabold tracking-[0.28em] text-base sm:text-lg text-white anime-glow-text">
                  QUEST INFO
                </span>
              </div>
            </div>
          </div>

          <div className="text-center font-mono text-xs sm:text-sm text-white/90 mb-1">
            [Daily Quest: Nutritional Intake Protocol has arrived.]
          </div>
          <div className="text-center font-mono text-[11px] text-[#9fd3ff]/80 mb-4">
            [ {todayKey} • +80 EXP ON FULL COMPLIANCE ]
          </div>

          <div className="text-center mb-4">
            <div className="inline-block border-b-2 border-white/70 pb-0.5">
              <div className="border-b border-white/40 pb-0.5">
                <span className="font-mono text-sm sm:text-base font-bold text-white tracking-[0.25em] anime-glow-text px-4">
                  GOAL
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-cyan-300/80 animate-pulse tracking-widest">
              [ THEIA IS COMPUTING YOUR INTAKE PROTOCOL... ]
            </div>
          ) : plan ? (
            <>
              {/* Macro targets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'KCAL', value: `${consumed.calories}/${plan.calories}` },
                  { label: 'PROTEIN', value: `${consumed.protein}/${plan.protein}g` },
                  { label: 'CARBS', value: `${plan.carbs}g` },
                  { label: 'FATS', value: `${plan.fats}g` },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-2 text-center"
                  >
                    <div className="text-[9px] tracking-[0.2em] text-[#9fd3ff]/70">{m.label}</div>
                    <div className="text-xs sm:text-sm font-bold text-white mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Directive */}
              <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-3 mb-4">
                <div className="text-[10px] tracking-[0.2em] text-cyan-300/80 mb-1">
                  THEIA DIRECTIVE • {plan.goal.toUpperCase()}
                </div>
                <p className="text-[11px] sm:text-xs text-white/85 leading-relaxed">{plan.directive}</p>
              </div>

              {/* Meals */}
              <div className="space-y-3 mb-4">
                {plan.meals.map((meal) => {
                  const done = log.mealsDone.includes(meal.id);
                  return (
                    <div
                      key={meal.id}
                      className={`border rounded-[2px] overflow-hidden transition-all shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] ${
                        done ? 'border-emerald-500/40 bg-[#061825]/90' : 'border-white/40 bg-[#061424]/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 p-3">
                        <div className="text-left min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <UtensilsCrossed
                              className={`w-3.5 h-3.5 shrink-0 ${done ? 'text-emerald-400' : 'text-[#9fd3ff]'}`}
                            />
                            <span
                              className={`text-xs sm:text-sm font-bold tracking-wider ${
                                done ? 'text-emerald-300' : 'text-white'
                              }`}
                            >
                              {meal.name}
                            </span>
                            {meal.time && (
                              <span className="text-[10px] text-[#9fd3ff]/70">{meal.time}</span>
                            )}
                          </div>
                          <ul className="mt-1.5 space-y-0.5">
                            {meal.items.map((item, i) => (
                              <li key={i} className="text-[11px] text-white/75 leading-snug">
                                • {item}
                              </li>
                            ))}
                          </ul>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#9fd3ff]/80">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" /> {meal.calories} kcal
                            </span>
                            <span className="flex items-center gap-1">
                              <Beef className="w-3 h-3" /> {meal.protein}g
                            </span>
                          </div>
                          {meal.notes && (
                            <div className="text-[10px] text-white/50 italic mt-1">{meal.notes}</div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleMeal(meal.id)}
                          className={`w-7 h-7 shrink-0 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                            done
                              ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                              : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60'
                          }`}
                        >
                          {done ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Hydration */}
                <div
                  className={`border rounded-[2px] flex items-center justify-between gap-3 p-3 ${
                    log.waterDone ? 'border-emerald-500/40 bg-[#061825]/90' : 'border-white/40 bg-[#061424]/80'
                  }`}
                >
                  <div className="flex items-center gap-2 text-left">
                    <Droplets className={`w-3.5 h-3.5 ${log.waterDone ? 'text-emerald-400' : 'text-[#9fd3ff]'}`} />
                    <div>
                      <div className="text-xs font-bold tracking-wider text-white">Hydration Directive</div>
                      <div className="text-[11px] text-[#9fd3ff]/80">
                        [{plan.waterLiters}L water consumed today]
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleWater}
                    className={`w-7 h-7 shrink-0 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                      log.waterDone
                        ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                        : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60'
                    }`}
                  >
                    {log.waterDone ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={handleClaim}
                  disabled={!allDone || log.claimed}
                  className={`flex-1 py-2 border-2 rounded-[2px] font-mono text-xs font-bold tracking-widest transition-all ${
                    log.claimed
                      ? 'border-emerald-500/40 text-emerald-400/70 bg-emerald-950/30'
                      : allDone
                        ? 'border-emerald-400 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900 shadow-[0_0_14px_rgba(52,211,153,0.4)]'
                        : 'border-white/20 text-white/30 bg-black/40 cursor-not-allowed'
                  }`}
                >
                  {log.claimed ? '[ REWARD CLAIMED ]' : '[ CLAIM INTAKE REWARD ]'}
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="py-2 px-4 border-2 border-cyan-400/60 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 font-mono text-xs font-bold tracking-widest rounded-[2px] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                  <span>{regenerating ? '[ ... ]' : '[ REISSUE ]'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-red-300/80">
              [ PROTOCOL UNAVAILABLE — RETRY LATER ]
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
