import { useState, useMemo } from 'react';
import {
  UserBodyMetrics,
  DietaryGoal,
  ActivityLevel,
  BiologicalSex,
  UserProfile,
} from '@/lib/types';
import {
  calculateIMC,
  calculateEnergyAndMacros,
  generateNutritionPlan,
  saveNutritionLog,
} from '@/lib/nutrition-lab';
import { saveUserBodyMetrics } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import {
  X,
  Scale,
  Ruler,
  Cake,
  Users,
  Target,
  Activity,
  Zap,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onCalibrated?: (updatedProfile: UserProfile) => void;
}

const GOALS: Array<{ id: DietaryGoal; label: string; delta: string }> = [
  { id: 'bulk', label: 'LEAN BULK', delta: '+350 kcal' },
  { id: 'recomp', label: 'RECOMP', delta: '-100 kcal' },
  { id: 'cut', label: 'CUT / SHRED', delta: '-450 kcal' },
  { id: 'maintain', label: 'MAINTAIN', delta: '±0 kcal' },
];

const ACTIVITIES: Array<{ id: ActivityLevel; label: string }> = [
  { id: 'sedentary', label: 'Sedentary' },
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Hunter Standard' },
  { id: 'heavy', label: 'High Intensity' },
];

const SEXES: BiologicalSex[] = ['male', 'female', 'other'];

export default function BiometricsCalibrationModal({
  isOpen,
  onClose,
  profile,
  onCalibrated,
}: Props) {
  const currentMetrics = profile.bodyMetrics || {
    weightKg: 72,
    heightCm: 175,
    age: 24,
    gender: 'male',
    activityLevel: 'moderate',
    dietaryGoal: 'bulk',
    isCalibrated: false,
  };

  const [weightKg, setWeightKg] = useState<number>(currentMetrics.weightKg || 72);
  const [heightCm, setHeightCm] = useState<number>(currentMetrics.heightCm || 175);
  const [age, setAge] = useState<number>(currentMetrics.age || 24);
  const [gender, setGender] = useState<BiologicalSex>(currentMetrics.gender || 'male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    currentMetrics.activityLevel || 'moderate'
  );
  const [dietaryGoal, setDietaryGoal] = useState<DietaryGoal>(
    currentMetrics.dietaryGoal || 'bulk'
  );
  const [saving, setSaving] = useState(false);

  // Live calculations — same precision engine as before, just displayed more compactly.
  const imcData = useMemo(() => calculateIMC(weightKg, heightCm), [weightKg, heightCm]);

  const targets = useMemo(
    () =>
      calculateEnergyAndMacros(
        { weightKg, heightCm, age, gender, activityLevel, dietaryGoal },
        profile.level
      ),
    [weightKg, heightCm, age, gender, activityLevel, dietaryGoal, profile.level]
  );

  if (!isOpen) return null;

  const handleSaveAndReissue = async (forceAlgorithmic = false) => {
    if (saving) return;
    systemSound.playClick();
    setSaving(true);

    try {
      const updatedMetrics: UserBodyMetrics = {
        weightKg: Number(weightKg),
        heightCm: Number(heightCm),
        age: Number(age),
        gender,
        activityLevel,
        dietaryGoal,
        isCalibrated: true,
        lastUpdated: new Date().toISOString(),
      };

      const updatedProfile = saveUserBodyMetrics(updatedMetrics);
      const newPlan = await generateNutritionPlan(updatedProfile, undefined, { forceAlgorithmic });

      saveNutritionLog({
        date: newPlan.date,
        mealsDone: [],
        waterDone: false,
        claimed: false,
        rewardedMealIds: [],
        waterRewarded: false,
      });

      toast.success('BIOMETRICS CALIBRATED & DIET REISSUED', {
        description: `Protocol tailored to ${weightKg}kg • IMC ${imcData.imc} (${imcData.label}).`,
      });

      onCalibrated?.(updatedProfile);
      onClose();
    } catch (err) {
      console.error('Failed to calibrate biometrics:', err);
      toast.error('CALIBRATION FAILED — PLEASE RETRY');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in font-mono overflow-y-auto">
      {/* Streamlined Solo Leveling System Window — same shell as the Recovery/Inventory modal */}
      <div className="relative max-w-[560px] w-full bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] font-mono anime-dropdown max-h-[92vh] flex flex-col my-auto">
        {/* Top Header Bar: Title Box + Close Icon */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-[#9fd3ff]" />
              <span className="font-mono font-extrabold tracking-[0.24em] text-sm sm:text-base text-white anime-glow-text">
                CALIBRATION
              </span>
            </div>
            <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">
              [BIOMETRIC SYNC]
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 text-xs">
          {/* Weight */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0">
                <Scale className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xs font-bold text-white tracking-wide">BODY WEIGHT</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setWeightKg((w) => Math.max(35, Math.round((w - 0.5) * 10) / 10))}
                className="w-7 h-7 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
              >
                -
              </button>
              <input
                type="number"
                step="0.5"
                min="35"
                max="220"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 70)}
                className="w-16 bg-black/60 border border-white/30 rounded-[2px] px-1.5 py-1 text-center font-bold text-white text-sm focus:border-cyan-400 focus:outline-none"
              />
              <span className="text-[10px] text-white/50 w-5">kg</span>
              <button
                type="button"
                onClick={() => setWeightKg((w) => Math.min(220, Math.round((w + 0.5) * 10) / 10))}
                className="w-7 h-7 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Height */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0">
                <Ruler className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xs font-bold text-white tracking-wide">HEIGHT</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setHeightCm((h) => Math.max(120, h - 1))}
                className="w-7 h-7 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
              >
                -
              </button>
              <input
                type="number"
                step="1"
                min="120"
                max="230"
                value={heightCm}
                onChange={(e) => setHeightCm(parseInt(e.target.value, 10) || 175)}
                className="w-16 bg-black/60 border border-white/30 rounded-[2px] px-1.5 py-1 text-center font-bold text-white text-sm focus:border-cyan-400 focus:outline-none"
              />
              <span className="text-[10px] text-white/50 w-5">cm</span>
              <button
                type="button"
                onClick={() => setHeightCm((h) => Math.min(230, h + 1))}
                className="w-7 h-7 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Age */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0">
                <Cake className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xs font-bold text-white tracking-wide">AGE</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setAge((a) => Math.max(14, a - 1))}
                className="w-7 h-7 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
              >
                -
              </button>
              <div className="w-16 text-center font-bold text-white text-sm">{age} yrs</div>
              <button
                type="button"
                onClick={() => setAge((a) => Math.min(90, a + 1))}
                className="w-7 h-7 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Biological sex */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xs font-bold text-white tracking-wide">SEX</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {SEXES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setGender(g);
                  }}
                  className={`px-2.5 py-1 border rounded-[2px] text-[10px] uppercase font-bold tracking-wider transition-all ${
                    gender === g
                      ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                      : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xs font-bold text-white tracking-wide">DIRECTIVE OBJECTIVE</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pl-[42px]">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setDietaryGoal(g.id);
                  }}
                  className={`px-2 py-1.5 border rounded-[2px] text-left transition-all flex items-center justify-between gap-1.5 ${
                    dietaryGoal === g.id
                      ? 'border-cyan-400 bg-cyan-950/80 text-white shadow-[0_0_8px_rgba(0,212,255,0.35)]'
                      : 'border-white/20 bg-black/40 text-white/70 hover:border-white/40'
                  }`}
                >
                  <span className="font-bold text-[10px]">{g.label}</span>
                  <span className="text-[9px] text-cyan-300 font-mono whitespace-nowrap">{g.delta}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Activity level */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xs font-bold text-white tracking-wide">CONDITIONING INTENSITY</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pl-[42px]">
              {ACTIVITIES.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setActivityLevel(act.id);
                  }}
                  className={`py-1.5 px-2 border rounded-[2px] text-[10px] font-bold tracking-wide transition-all ${
                    activityLevel === act.id
                      ? 'border-cyan-400 bg-cyan-950/80 text-white shadow-[0_0_8px_rgba(0,212,255,0.35)]'
                      : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live computed target strip — single source of truth, no duplicated numbers */}
          <div
            className="p-3 rounded-[2px] border transition-all"
            style={{ borderColor: imcData.color, backgroundColor: imcData.badgeBg }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-black text-lg" style={{ color: imcData.color }}>
                  {imcData.imc}
                </span>
                <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: imcData.color }}>
                  {imcData.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold flex-wrap">
                <span className="px-1.5 py-0.5 bg-black/50 border border-white/20 rounded-[2px] text-white">
                  {targets.calories} kcal
                </span>
                <span className="px-1.5 py-0.5 bg-black/50 border border-white/20 rounded-[2px] text-emerald-300">
                  {targets.protein}g protein
                </span>
                <span className="px-1.5 py-0.5 bg-black/50 border border-white/20 rounded-[2px] text-amber-300">
                  {targets.carbs}g carbs
                </span>
                <span className="px-1.5 py-0.5 bg-black/50 border border-white/20 rounded-[2px] text-rose-300">
                  {targets.fats}g fats
                </span>
                <span className="px-1.5 py-0.5 bg-black/50 border border-white/20 rounded-[2px] text-blue-300">
                  {targets.waterLiters}L
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-white/50">
              BMR {targets.bmr} kcal • TDEE {targets.tdee} kcal
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-3 pt-2 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => handleSaveAndReissue(true)}
            disabled={saving}
            className="flex-1 py-2 px-3 border border-emerald-500/60 bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="Generate diet using precision deterministic sports physiology (0 LLM tokens)"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>[ PRESCRIBE • 0 TOKENS ]</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveAndReissue(false)}
            disabled={saving}
            className="flex-1 py-2 px-3 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_14px_rgba(0,212,255,0.4)] disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? '[ GENERATING... ]' : '[ GENERATE VIA AI ]'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
