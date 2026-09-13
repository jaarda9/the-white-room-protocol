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
  getTodayKey,
} from '@/lib/nutrition-lab';
import { saveUserBodyMetrics, saveUserProfile } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import {
  X,
  Scale,
  Ruler,
  Activity,
  Flame,
  Beef,
  Droplets,
  Check,
  Sparkles,
  Zap,
  Info,
  ChevronRight,
  Shield,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onCalibrated?: (updatedProfile: UserProfile) => void;
}

const GOALS: Array<{ id: DietaryGoal; label: string; desc: string; delta: string }> = [
  { id: 'bulk', label: 'LEAN BULK', desc: 'Muscular hypertrophy & recovery surplus', delta: '+350 kcal' },
  { id: 'recomp', label: 'RECOMPOSITION', desc: 'Iso-caloric fat loss & muscle density', delta: '-100 kcal' },
  { id: 'cut', label: 'CUTTING / SHRED', desc: 'Precision deficit to reveal muscle definition', delta: '-450 kcal' },
  { id: 'maintain', label: 'MAINTENANCE', desc: 'Athletic equilibrium & sustained stamina', delta: '±0 kcal' },
];

const ACTIVITIES: Array<{ id: ActivityLevel; label: string; multiplierText: string }> = [
  { id: 'sedentary', label: 'Sedentary', multiplierText: 'Desk routine / Minimal training' },
  { id: 'light', label: 'Light Active', multiplierText: '1-2 training sessions / week' },
  { id: 'moderate', label: 'Hunter Standard', multiplierText: '3-5 kinetic training sessions / week' },
  { id: 'heavy', label: 'High Intensity', multiplierText: '6+ daily athletic conditioning sessions' },
];

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

  // Live calculations
  const imcData = useMemo(() => calculateIMC(weightKg, heightCm), [weightKg, heightCm]);

  const targets = useMemo(
    () =>
      calculateEnergyAndMacros(
        {
          weightKg,
          heightCm,
          age,
          gender,
          activityLevel,
          dietaryGoal,
        },
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

      // Reissue plan
      const newPlan = await generateNutritionPlan(updatedProfile, undefined, {
        forceAlgorithmic,
      });

      // Reset log for the freshly reissued plan
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

      if (onCalibrated) {
        onCalibrated(updatedProfile);
      }
      onClose();
    } catch (err) {
      console.error('Failed to calibrate biometrics:', err);
      toast.error('CALIBRATION FAILED — PLEASE RETRY');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0a1b2e] border-2 border-cyan-400/80 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_40px_rgba(0,212,255,0.35),inset_0_0_30px_rgba(0,212,255,0.1)] max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[2px] bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center text-cyan-300">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-[#9fd3ff] tracking-[0.2em] font-bold">
                [ HUNTER PHYSICAL CALIBRATION ]
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wider anime-glow-text">
                BIOMETRICS & IMC (BMI) ENGINE
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="w-7 h-7 rounded-[2px] border border-white/30 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* Live IMC Status Hero Banner */}
          <div
            className="p-3.5 rounded-[2px] border transition-all"
            style={{
              borderColor: imcData.color,
              backgroundColor: imcData.badgeBg,
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <div
                  className="px-3 py-1.5 border rounded-[2px] font-black text-xl sm:text-2xl tracking-wider shadow-[0_0_12px_rgba(0,0,0,0.5)]"
                  style={{ borderColor: imcData.color, color: imcData.color }}
                >
                  {imcData.imc}
                </div>
                <div>
                  <div className="text-[9px] text-white/70 tracking-widest">
                    INDICE DE MASSE CORPORELLE (IMC / BMI)
                  </div>
                  <div
                    className="font-extrabold text-xs sm:text-sm tracking-widest uppercase"
                    style={{ color: imcData.color }}
                  >
                    STATUS: {imcData.label}
                  </div>
                </div>
              </div>

              {/* Targets Pill Bar */}
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold">
                <div className="px-2 py-1 bg-black/50 border border-white/20 rounded-[2px] text-white">
                  <span className="text-[#9fd3ff]">TARGET: </span>
                  {targets.calories} kcal
                </div>
                <div className="px-2 py-1 bg-black/50 border border-white/20 rounded-[2px] text-white">
                  <span className="text-emerald-400">PROT: </span>
                  {targets.protein}g
                </div>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-white/85 leading-relaxed">
              {imcData.description}
            </p>
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Weight Input */}
            <div className="p-3 border border-white/30 bg-[#061424]/90 rounded-[2px]">
              <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3 h-3 text-cyan-400" /> BODY WEIGHT (KG)
                </span>
                <span className="text-white font-mono">{weightKg} kg</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeightKg((w) => Math.max(35, Math.round((w - 0.5) * 10) / 10))}
                  className="w-8 h-8 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
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
                  className="flex-1 bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-center font-bold text-white text-sm focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setWeightKg((w) => Math.min(220, Math.round((w + 0.5) * 10) / 10))}
                  className="w-8 h-8 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Height Input */}
            <div className="p-3 border border-white/30 bg-[#061424]/90 rounded-[2px]">
              <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Ruler className="w-3 h-3 text-cyan-400" /> HEIGHT (CM)
                </span>
                <span className="text-white font-mono">{heightCm} cm</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHeightCm((h) => Math.max(120, h - 1))}
                  className="w-8 h-8 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
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
                  className="flex-1 bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-center font-bold text-white text-sm focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setHeightCm((h) => Math.min(230, h + 1))}
                  className="w-8 h-8 border border-white/30 bg-black/40 hover:bg-white/10 text-white rounded-[2px] flex items-center justify-center font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Biological Sex & Age */}
            <div className="p-3 border border-white/30 bg-[#061424]/90 rounded-[2px]">
              <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
                BIOLOGICAL PROFILE (METABOLIC BASELINE)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['male', 'female', 'other'] as BiologicalSex[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      systemSound.playClick();
                      setGender(g);
                    }}
                    className={`py-1.5 border rounded-[2px] text-[10px] uppercase font-bold tracking-wider transition-all ${
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

            {/* Age Input */}
            <div className="p-3 border border-white/30 bg-[#061424]/90 rounded-[2px]">
              <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider flex items-center justify-between mb-1.5">
                <span>HUNTER AGE</span>
                <span className="text-white">{age} YRS</span>
              </label>
              <input
                type="range"
                min="16"
                max="75"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Objective / Dietary Goal Selector */}
          <div className="p-3 border border-white/30 bg-[#061424]/90 rounded-[2px]">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-2">
              INTAKE DIRECTIVE OBJECTIVE
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setDietaryGoal(g.id);
                  }}
                  className={`p-2.5 border rounded-[2px] text-left transition-all flex flex-col justify-between ${
                    dietaryGoal === g.id
                      ? 'border-cyan-400 bg-cyan-950/80 text-white shadow-[0_0_10px_rgba(0,212,255,0.35)]'
                      : 'border-white/20 bg-black/40 text-white/70 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>{g.label}</span>
                    <span className="text-[10px] text-cyan-300 font-mono">{g.delta}</span>
                  </div>
                  <div className="text-[10px] text-white/60 mt-1">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Conditioning Activity Level */}
          <div className="p-3 border border-white/30 bg-[#061424]/90 rounded-[2px]">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-2">
              CONDITIONING INTENSITY FREQUENCY
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ACTIVITIES.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setActivityLevel(act.id);
                  }}
                  className={`p-2 border rounded-[2px] text-left transition-all ${
                    activityLevel === act.id
                      ? 'border-cyan-400 bg-cyan-950/80 text-white shadow-[0_0_8px_rgba(0,212,255,0.35)]'
                      : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-[11px]">{act.label}</div>
                  <div className="text-[9px] text-white/50 truncate mt-0.5">
                    {act.multiplierText}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Computed Macro Breakdown Card */}
          <div className="p-3.5 border border-cyan-500/40 bg-[#07172b]/80 rounded-[2px] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-cyan-300">
                PHYSIOLOGICAL TARGET SUMMARY
              </span>
              <span className="text-[10px] text-white/60">
                BMR: {targets.bmr} kcal • TDEE: {targets.tdee} kcal
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-2 border border-white/20 bg-black/40 rounded-[2px] text-center">
                <div className="text-[9px] text-cyan-300/80 tracking-wider">DAILY KCAL</div>
                <div className="text-sm font-bold text-white mt-0.5">{targets.calories}</div>
              </div>
              <div className="p-2 border border-white/20 bg-black/40 rounded-[2px] text-center">
                <div className="text-[9px] text-emerald-400 tracking-wider">PROTEIN</div>
                <div className="text-sm font-bold text-white mt-0.5">{targets.protein}g</div>
                <div className="text-[8px] text-white/50">
                  {Math.round((targets.protein / targets.weightKg) * 10) / 10}g/kg
                </div>
              </div>
              <div className="p-2 border border-white/20 bg-black/40 rounded-[2px] text-center">
                <div className="text-[9px] text-amber-300 tracking-wider">CARBS</div>
                <div className="text-sm font-bold text-white mt-0.5">{targets.carbs}g</div>
              </div>
              <div className="p-2 border border-white/20 bg-black/40 rounded-[2px] text-center">
                <div className="text-[9px] text-rose-300 tracking-wider">HEALTHY FATS</div>
                <div className="text-sm font-bold text-white mt-0.5">{targets.fats}g</div>
              </div>
              <div className="p-2 border border-white/20 bg-black/40 rounded-[2px] text-center col-span-2 sm:col-span-1">
                <div className="text-[9px] text-blue-300 tracking-wider">HYDRATION</div>
                <div className="text-sm font-bold text-white mt-0.5">{targets.waterLiters}L</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 mt-3 border-t border-white/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            disabled={saving}
            className="py-2 px-3 border border-white/30 bg-black/40 text-white/70 hover:text-white rounded-[2px] text-xs font-bold transition-colors"
          >
            [ CANCEL ]
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveAndReissue(true)}
              disabled={saving}
              className="py-2 px-3.5 border border-emerald-500/60 bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 rounded-[2px] text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(52,211,153,0.2)]"
              title="Generate diet using precision deterministic sports physiology (0 LLM tokens)"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>[ PRESCRIBE • 0 TOKENS ]</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAndReissue(false)}
              disabled={saving}
              className="py-2 px-4 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_14px_rgba(0,212,255,0.4)] disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? '[ GENERATING... ]' : '[ GENERATE VIA AI ]'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
