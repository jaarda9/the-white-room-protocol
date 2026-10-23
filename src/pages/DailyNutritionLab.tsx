import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile, addXP, DEFAULT_BODY_METRICS } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import {
  loadOrGenerateNutritionPlan,
  generateNutritionPlan,
  getNutritionLog,
  saveNutritionLog,
  clearStoredNutritionPlan,
  getTodayKey,
  calculateIMC,
  calculateEnergyAndMacros,
  getHandPortionsGuide,
  getDefaultIntakeCheckpoints,
  type NutritionPlan,
  type NutritionLog,
} from '@/lib/nutrition-lab';
import { systemSound } from '@/lib/system-sound';
import BiometricsCalibrationModal from '@/components/BiometricsCalibrationModal';
import {
  ArrowLeft,
  Info,
  UtensilsCrossed,
  Check,
  Droplets,
  RefreshCw,
  Flame,
  Beef,
  Scale,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Hand,
  Lightbulb,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailyNutritionLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [log, setLog] = useState<NutritionLog>(() => getNutritionLog());
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);
  const [showHandCodex, setShowHandCodex] = useState(false);

  const todayKey = useMemo(() => getTodayKey(), []);

  const bodyMetrics = useMemo(
    () => profile.bodyMetrics || { ...DEFAULT_BODY_METRICS },
    [profile.bodyMetrics]
  );

  const imcData = useMemo(
    () => calculateIMC(bodyMetrics.weightKg, bodyMetrics.heightCm),
    [bodyMetrics.weightKg, bodyMetrics.heightCm]
  );

  const targets = useMemo(
    () => calculateEnergyAndMacros(bodyMetrics, profile.level),
    [bodyMetrics, profile.level]
  );

  const handGuide = useMemo(() => getHandPortionsGuide(targets), [targets]);
  const defaultCheckpoints = useMemo(() => getDefaultIntakeCheckpoints(targets), [targets]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = getUserProfile();
      setProfile(p);
      // Only loads an existing plan if one was saved today; never auto-calls AI
      const nextPlan = await loadOrGenerateNutritionPlan(p);
      setPlan(nextPlan);
      setLog(getNutritionLog(nextPlan?.date || todayKey));
    } catch (e) {
      console.error('Failed to load nutrition protocol:', e);
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Per-item XP reward payouts (12 XP per meal, 12 XP for water, 20 XP bonus on full protocol completion = 80 XP total)
  const MEAL_XP = 12;
  const WATER_XP = 12;
  const COMPLETION_BONUS_XP = 20;

  const persistLog = (next: NutritionLog) => {
    setLog(next);
    saveNutritionLog(next);
  };

  const toggleMeal = (id: string) => {
    systemSound.playClick();
    const done = log.mealsDone.includes(id);
    const nextMealsDone = done ? log.mealsDone.filter((m) => m !== id) : [...log.mealsDone, id];
    const shouldReward = !done && !log.rewardedMealIds.includes(id);

    persistLog({
      ...log,
      mealsDone: nextMealsDone,
      rewardedMealIds: shouldReward ? [...log.rewardedMealIds, id] : log.rewardedMealIds,
    });

    if (shouldReward) {
      const updated = addXP(profile, MEAL_XP, 'physical');
      saveUserProfile(updated);
      setProfile(updated);
      toast.success(`+${MEAL_XP} EXP`, { description: 'Intake logged.' });
    }
  };

  const toggleWater = () => {
    systemSound.playClick();
    const nextWaterDone = !log.waterDone;
    const shouldReward = nextWaterDone && !log.waterRewarded;

    persistLog({
      ...log,
      waterDone: nextWaterDone,
      waterRewarded: shouldReward ? true : log.waterRewarded,
    });

    if (shouldReward) {
      const updated = addXP(profile, WATER_XP, 'physical');
      saveUserProfile(updated);
      setProfile(updated);
      toast.success(`+${WATER_XP} EXP`, { description: 'Hydration directive logged.' });
    }
  };

  const handleGenerateBlueprint = async (forceAlgorithmic = false) => {
    if (regenerating) return;
    systemSound.playClick();
    setRegenerating(true);
    try {
      const fresh = await generateNutritionPlan(profile, undefined, { forceAlgorithmic });
      setPlan(fresh);
      toast.success(
        forceAlgorithmic ? 'HAND-MEASURED BLUEPRINT GENERATED (0 TOKENS)' : 'AI MEAL BLUEPRINT READY'
      );
    } catch (err) {
      console.error('Failed to generate blueprint:', err);
      toast.error('Could not generate meal blueprint.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDismissBlueprint = () => {
    systemSound.playClick();
    clearStoredNutritionPlan();
    setPlan(null);
    toast.info('Returned to flexible target checkpoints.');
  };

  const handleProfileCalibrated = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    const nextPlan = loadOrGenerateNutritionPlan(updatedProfile);
    nextPlan.then((p) => {
      setPlan(p);
      setLog(getNutritionLog(p ? p.date : todayKey));
    });
  };

  const activeCheckpoints = useMemo(() => {
    if (plan && plan.meals && plan.meals.length > 0) {
      return plan.meals.map((m) => ({
        id: m.id,
        name: m.name,
        time: m.time,
        items: m.items,
        calories: m.calories,
        protein: m.protein,
        notes: m.notes,
        isCustomBlueprint: true,
      }));
    }
    return defaultCheckpoints.map((d) => ({
      id: d.id,
      name: d.name,
      time: d.role,
      items: [d.handGuide, `Examples: ${d.examples}`],
      calories: d.calories,
      protein: d.protein,
      notes: undefined,
      isCustomBlueprint: false,
    }));
  }, [plan, defaultCheckpoints]);

  const mealsDone = activeCheckpoints.filter((m) => log.mealsDone.includes(m.id)).length;
  const mealsTotal = activeCheckpoints.length;
  const allDone = mealsTotal > 0 && mealsDone === mealsTotal && log.waterDone;

  const totalTrackable = mealsTotal + 1; // 4 meals + water
  const completedTrackable = mealsDone + (log.waterDone ? 1 : 0);

  const consumed = activeCheckpoints
    .filter((m) => log.mealsDone.includes(m.id))
    .reduce(
      (acc, m) => ({ calories: acc.calories + m.calories, protein: acc.protein + m.protein }),
      { calories: 0, protein: 0 }
    );

  const handleClaim = () => {
    if (!allDone || log.claimed) {
      systemSound.playClick();
      return;
    }
    systemSound.playLevelUp();
    const updated = addXP(profile, COMPLETION_BONUS_XP, 'physical');
    saveUserProfile(updated);
    setProfile(updated);
    persistLog({ ...log, claimed: true });
    toast.success('DIET PROTOCOL FULFILLED', {
      description: `+${COMPLETION_BONUS_XP} Completion Bonus EXP acquired. Recovery capacity reinforced.`,
    });
  };

  const currentWaterLiters = plan?.waterLiters || targets.waterLiters;

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[640px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
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
              TOTAL: [{completedTrackable}/{totalTrackable}]
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
          <div className="text-center font-mono text-[11px] text-[#9fd3ff]/80 mb-3">
            [ {todayKey} • +80 TOTAL EXP ON FULL COMPLIANCE ]
          </div>

          {/* Uncalibrated Attention Banner */}
          {!bodyMetrics.isCalibrated && (
            <div className="mb-3.5 p-2.5 border border-cyan-400/60 bg-cyan-950/60 rounded-[2px] flex items-center justify-between gap-2 text-xs shadow-[0_0_15px_rgba(0,212,255,0.25)]">
              <div className="flex items-center gap-2 text-cyan-200">
                <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-[11px]">
                  [ SYSTEM NOTICE: Using baseline biometrics (72kg/175cm). Calibrate for custom metrics. ]
                </span>
              </div>
              <button
                onClick={() => {
                  systemSound.playClick();
                  setCalibrationModalOpen(true);
                }}
                className="px-2 py-1 border border-cyan-300 bg-cyan-400 text-black font-bold text-[10px] tracking-wider rounded-[1px] shrink-0 hover:bg-white transition-colors"
              >
                CALIBRATE
              </button>
            </div>
          )}

          {/* Biometrics HUD Summary Badge Bar */}
          <div className="mb-4 p-2.5 border border-white/30 bg-[#061426]/90 rounded-[2px] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 text-xs flex-wrap">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                <span>{bodyMetrics.weightKg} KG</span>
                <span className="text-white/40">•</span>
                <span>{bodyMetrics.heightCm} CM</span>
              </div>

              <div
                className="px-2 py-0.5 border rounded-[2px] text-[10px] font-bold tracking-wider"
                style={{
                  borderColor: imcData.color,
                  color: imcData.color,
                  backgroundColor: imcData.badgeBg,
                }}
              >
                IMC {imcData.imc} [{imcData.label}]
              </div>

              <div className="text-[10px] px-2 py-0.5 border border-white/20 bg-black/40 text-[#9fd3ff] font-bold uppercase rounded-[2px]">
                {bodyMetrics.dietaryGoal || 'BULK'}
              </div>
            </div>

            <button
              onClick={() => {
                systemSound.playClick();
                setCalibrationModalOpen(true);
              }}
              className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-1 rounded-[2px] transition-all ml-auto"
              title="Calibrate weight, height, age, and dietary goal"
            >
              <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
              <span>[ CALIBRATE ]</span>
            </button>
          </div>

          {/* GOAL Header */}
          <div className="text-center mb-4">
            <div className="inline-block border-b-2 border-white/70 pb-0.5">
              <div className="border-b border-white/40 pb-0.5">
                <span className="font-mono text-sm sm:text-base font-bold text-white tracking-[0.25em] anime-glow-text px-4">
                  DAILY TARGET HUD
                </span>
              </div>
            </div>
          </div>

          {/* Always-Visible Targets HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-2 text-center">
              <div className="text-[9px] tracking-[0.2em] text-[#9fd3ff]/70">CALORIC TARGET</div>
              <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                {consumed.calories > 0 ? `${consumed.calories}/` : ''}{targets.calories} <span className="text-[10px] text-white/50">kcal</span>
              </div>
              <div className="text-[9px] text-cyan-300/70 mt-0.5 uppercase tracking-wider">{bodyMetrics.dietaryGoal || 'BULK'}</div>
            </div>

            <div className="border border-emerald-500/40 bg-[#061825]/80 rounded-[2px] p-2 text-center">
              <div className="text-[9px] tracking-[0.2em] text-emerald-300/80">PROTEIN FLOOR</div>
              <div className="text-xs sm:text-sm font-bold text-emerald-300 mt-0.5">
                {consumed.protein > 0 ? `${consumed.protein}/` : ''}{targets.protein}g
              </div>
              <div className="text-[9px] text-emerald-200/70 mt-0.5">~{handGuide.proteinPalms} Palms</div>
            </div>

            <div className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-2 text-center">
              <div className="text-[9px] tracking-[0.2em] text-[#9fd3ff]/70">COMPLEX CARBS</div>
              <div className="text-xs sm:text-sm font-bold text-white mt-0.5">{targets.carbs}g</div>
              <div className="text-[9px] text-[#9fd3ff]/70 mt-0.5">~{handGuide.carbsFists} Fists</div>
            </div>

            <div className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-2 text-center">
              <div className="text-[9px] tracking-[0.2em] text-[#9fd3ff]/70">HEALTHY FATS</div>
              <div className="text-xs sm:text-sm font-bold text-white mt-0.5">{targets.fats}g</div>
              <div className="text-[9px] text-[#9fd3ff]/70 mt-0.5">~{handGuide.fatsThumbs} Thumbs</div>
            </div>
          </div>

          {/* Directive banner */}
          <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-3 mb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-left text-[11px] sm:text-xs text-white/85 leading-relaxed">
              <span className="text-cyan-300 font-bold uppercase tracking-wider">PROTOCOL DIRECTIVE: </span>
              {targets.directive}
            </div>
          </div>

          {/* Hunter Hand-Scale Visual Codex (Collapsible) */}
          <div className="mb-4 border border-amber-500/30 bg-[#171305]/60 rounded-[2px] overflow-hidden transition-all shadow-[0_0_12px_rgba(245,166,35,0.08)]">
            <button
              type="button"
              onClick={() => {
                systemSound.playClick();
                setShowHandCodex((prev) => !prev);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-left bg-amber-950/30 hover:bg-amber-950/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Hand className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-200 tracking-wider">
                  HUNTER VISUAL HAND-SCALE RATIOS (NO KITCHEN SCALE)
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-300 font-bold">
                <span>{showHandCodex ? '[ HIDE ]' : '[ VIEW CODEX ]'}</span>
                {showHandCodex ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </div>
            </button>

            {showHandCodex && (
              <div className="p-3 border-t border-amber-500/20 text-xs text-white/85 space-y-2 bg-[#0d0a02]/90 font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 border border-white/10 bg-black/40 rounded-[2px]">
                    <div className="text-amber-300 font-bold flex items-center gap-1.5 mb-1">
                      <span>✋ 1 PALM (~25-30g Protein)</span>
                    </div>
                    <div className="text-white/70 text-[10px] leading-relaxed">
                      1 chicken breast, 1 fish fillet, 1 lean beef burger patty, 1 can tuna, or 3-4 whole eggs.
                    </div>
                  </div>

                  <div className="p-2 border border-white/10 bg-black/40 rounded-[2px]">
                    <div className="text-amber-300 font-bold flex items-center gap-1.5 mb-1">
                      <span>✊ 1 FIST (~35-45g Carbs)</span>
                    </div>
                    <div className="text-white/70 text-[10px] leading-relaxed">
                      1 fist cooked rice, pasta, or 1 medium baked potato / sweet potato.
                    </div>
                  </div>

                  <div className="p-2 border border-white/10 bg-black/40 rounded-[2px]">
                    <div className="text-amber-300 font-bold flex items-center gap-1.5 mb-1">
                      <span>🤲 1 CUPPED HAND (~25-30g Carbs)</span>
                    </div>
                    <div className="text-white/70 text-[10px] leading-relaxed">
                      Dry oats, lentils, beans, or fresh seasonal berries / fruit.
                    </div>
                  </div>

                  <div className="p-2 border border-white/10 bg-black/40 rounded-[2px]">
                    <div className="text-amber-300 font-bold flex items-center gap-1.5 mb-1">
                      <span>👍 1 THUMB / HANDFUL (~8-10g Fats)</span>
                    </div>
                    <div className="text-white/70 text-[10px] leading-relaxed">
                      1 closed handful almonds/peanuts, 1 thumb olive oil drizzle, or 1 tbsp peanut butter.
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-amber-200/60 text-center italic pt-1">
                  Use your hand as a quick visual gauge anywhere. No calorie tracking app or weighing scale needed.
                </div>
              </div>
            )}
          </div>

          {/* Tactical Meal Blueprint Generator Strip */}
          <div className="mb-4 p-3 border border-cyan-400/30 bg-[#071829]/80 rounded-[2px] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-[0_0_15px_rgba(0,212,255,0.08)]">
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-wide">
                <Lightbulb className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {plan ? 'ACTIVE MEAL BLUEPRINT IN USE' : 'WANT TACTICAL MEAL INSPIRATION?'}
                </span>
              </div>
              <p className="text-[10px] text-[#9fd3ff]/70 mt-0.5 leading-snug">
                {plan
                  ? 'Showing custom hand-measured meal proposals. You can dismiss back to flexible checkpoints anytime.'
                  : 'Optionally consult THEIA for hand-measured meal proposals, or simply check off your intakes below.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {plan ? (
                <button
                  type="button"
                  onClick={handleDismissBlueprint}
                  className="px-2.5 py-1.5 border border-white/30 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-mono font-bold tracking-wider rounded-[2px] transition-all flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>[ DISMISS ]</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => handleGenerateBlueprint(true)}
                disabled={regenerating}
                className="px-3 py-1.5 border border-emerald-500/60 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-[10px] font-mono font-bold tracking-wider rounded-[2px] transition-all flex items-center gap-1 disabled:opacity-50"
                title="Generate instantly using sports science without LLM tokens"
              >
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>[ 0 TOKENS ]</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateBlueprint(false)}
                disabled={regenerating}
                className="px-3 py-1.5 border border-cyan-400/70 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-[10px] font-mono font-bold tracking-wider rounded-[2px] transition-all flex items-center gap-1 disabled:opacity-50"
                title="Generate custom AI meal blueprint"
              >
                <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                <span>{regenerating ? '[ ... ]' : '[ AI BLUEPRINT ]'}</span>
              </button>
            </div>
          </div>

          {/* Daily Fuel Intakes Checklist */}
          <div className="space-y-3 mb-4">
            {activeCheckpoints.map((checkpoint) => {
              const done = log.mealsDone.includes(checkpoint.id);
              return (
                <div
                  key={checkpoint.id}
                  className={`border rounded-[2px] overflow-hidden transition-all shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] ${
                    done ? 'border-emerald-500/40 bg-[#061825]/90' : 'border-white/40 bg-[#061424]/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="text-left min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <UtensilsCrossed
                          className={`w-3.5 h-3.5 shrink-0 ${done ? 'text-emerald-400' : 'text-[#9fd3ff]'}`}
                        />
                        <span
                          className={`text-xs sm:text-sm font-bold tracking-wider ${
                            done ? 'text-emerald-300' : 'text-white'
                          }`}
                        >
                          {checkpoint.name}
                        </span>
                        {checkpoint.time && (
                          <span className="text-[10px] text-[#9fd3ff]/70 border border-white/10 px-1.5 py-0.2 rounded bg-black/30">
                            {checkpoint.time}
                          </span>
                        )}
                      </div>

                      <ul className="mt-1.5 space-y-0.5">
                        {checkpoint.items.map((item, i) => (
                          <li key={i} className="text-[11px] text-white/80 leading-snug">
                            • {item}
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#9fd3ff]/80">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" /> {checkpoint.calories} kcal
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Beef className="w-3 h-3" /> {checkpoint.protein}g protein
                        </span>
                      </div>

                      {checkpoint.notes && (
                        <div className="text-[10px] text-white/50 italic mt-1">{checkpoint.notes}</div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleMeal(checkpoint.id)}
                      className={`w-8 h-8 shrink-0 border-2 rounded-[2px] flex items-center justify-center transition-all cursor-pointer ${
                        done
                          ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                          : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60'
                      }`}
                      title={done ? 'Marked complete. Tap to toggle.' : 'Tap to mark intake fulfilled (+12 EXP)'}
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

            {/* Hydration Directive */}
            <div
              className={`border rounded-[2px] flex items-center justify-between gap-3 p-3 transition-all ${
                log.waterDone ? 'border-emerald-500/40 bg-[#061825]/90' : 'border-white/40 bg-[#061424]/80'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <Droplets className={`w-4 h-4 ${log.waterDone ? 'text-emerald-400' : 'text-[#9fd3ff]'}`} />
                <div>
                  <div className="text-xs font-bold tracking-wider text-white">Daily Hydration Directive</div>
                  <div className="text-[11px] text-[#9fd3ff]/80 mt-0.5">
                    [{currentWaterLiters}L target • ~{handGuide.waterGlasses} glasses / 3-4 bottles]
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleWater}
                className={`w-8 h-8 shrink-0 border-2 rounded-[2px] flex items-center justify-center transition-all cursor-pointer ${
                  log.waterDone
                    ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                    : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60'
                }`}
                title={log.waterDone ? 'Hydration fulfilled. Tap to toggle.' : 'Tap to mark hydration completed (+12 EXP)'}
              >
                {log.waterDone ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                )}
              </button>
            </div>
          </div>

          {/* Bottom Actions: Claim Completion Bonus (+20 EXP Bonus) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={handleClaim}
              disabled={!allDone || log.claimed}
              className={`flex-1 py-2.5 border-2 rounded-[2px] font-mono text-xs font-bold tracking-widest transition-all ${
                log.claimed
                  ? 'border-emerald-500/40 text-emerald-400/70 bg-emerald-950/30'
                  : allDone
                    ? 'border-emerald-400 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900 shadow-[0_0_14px_rgba(52,211,153,0.4)] cursor-pointer'
                    : 'border-white/20 text-white/30 bg-black/40 cursor-not-allowed'
              }`}
            >
              {log.claimed
                ? '[ ALL PROTOCOL REWARDS CLAIMED ]'
                : allDone
                  ? `[ CLAIM COMPLETION BONUS (+${COMPLETION_BONUS_XP} EXP) ]`
                  : `[ COMPLETE ALL INTAKES TO CLAIM BONUS (${completedTrackable}/${totalTrackable}) ]`}
            </button>
          </div>

          <div className="mt-2 text-center text-[10px] text-white/40">
            {allDone
              ? 'All daily nutritional intake directives verified.'
              : `${completedTrackable} of ${totalTrackable} directives fulfilled.`}
          </div>

        </div>
      </main>

      {/* Biometrics Calibration Modal */}
      <BiometricsCalibrationModal
        isOpen={calibrationModalOpen}
        onClose={() => setCalibrationModalOpen(false)}
        profile={profile}
        onCalibrated={handleProfileCalibrated}
      />
    </div>
  );
}
