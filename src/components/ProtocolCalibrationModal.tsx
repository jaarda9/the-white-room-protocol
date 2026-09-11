import { useState, useMemo } from 'react';
import {
  HunterProtocolConfig,
  getHunterProtocolConfig,
  saveHunterProtocolConfig,
  resetHunterProtocolToSystem,
  CustomDayPlan,
  CustomDayExercise,
  PhysicalLogRowKind,
  getUserBodyMetrics,
  saveUserBodyMetrics,
  getUserProfile,
} from '@/lib/storage';
import { UserBodyMetrics, BiologicalSex, ActivityLevel, DietaryGoal } from '@/lib/types';
import {
  calculateIMC,
  calculateEnergyAndMacros,
  generateNutritionPlan,
  saveNutritionLog,
} from '@/lib/nutrition-lab';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENTS,
  EXERCISE_LIBRARY,
  PRESET_SPLIT_TEMPLATES,
  ExerciseCategory,
  ExerciseEquipment,
  searchExercises,
  ExerciseDefinition,
} from '@/lib/exercise-library';
import { systemSound } from '@/lib/system-sound';
import {
  Dumbbell,
  BookOpen,
  X,
  Search,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  Info,
  Shield,
  Clock,
  Bed,
  Scale,
  Ruler,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProtocolCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  isOnboarding?: boolean;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon through Sun

export default function ProtocolCalibrationModal({
  isOpen,
  onClose,
  onSaved,
  isOnboarding = false,
}: ProtocolCalibrationModalProps) {
  const [config, setConfig] = useState<HunterProtocolConfig>(() => getHunterProtocolConfig());
  const [activeSection, setActiveSection] = useState<'physical' | 'mental' | 'nutrition'>('physical');
  const [bodyMetrics, setBodyMetrics] = useState<UserBodyMetrics>(() => getUserBodyMetrics());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1); // Monday default
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Exercise library search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'All'>('All');
  const [selectedEquipment, setSelectedEquipment] = useState<ExerciseEquipment | 'All'>('All');
  const [customExerciseName, setCustomExerciseName] = useState('');

  const filteredExercises = useMemo(() => {
    return searchExercises(searchQuery, selectedCategory, selectedEquipment);
  }, [searchQuery, selectedCategory, selectedEquipment]);

  if (!isOpen) return null;

  const currentDayPlan: CustomDayPlan = config.customWeeklySplit[selectedDayIndex] || {
    dayIndex: selectedDayIndex,
    dayName: DAY_NAMES[selectedDayIndex],
    focus: 'Conditioning',
    isRestDay: false,
    exercises: [],
  };

  const handleApplyPresetTemplate = (templateId: string) => {
    const template = PRESET_SPLIT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    systemSound.playClick();

    const newSplit: Record<number, CustomDayPlan> = {};
    for (let i = 0; i < 7; i++) {
      const sched = template.schedule[i];
      const exercises: CustomDayExercise[] = (sched?.exerciseIds || [])
        .map((id) => {
          const def = EXERCISE_LIBRARY.find((e) => e.id === id);
          if (!def) return null;
          return {
            id: def.id,
            name: def.name,
            kind: def.kind,
            targetSets: def.defaultSets,
            targetReps: def.defaultReps,
            targetMinutes: def.defaultMinutes,
            category: def.category,
          };
        })
        .filter((e): e is CustomDayExercise => Boolean(e));

      newSplit[i] = {
        dayIndex: i,
        dayName: DAY_NAMES[i],
        focus: sched?.focus || (i === 0 ? 'Rest & Recovery' : 'Conditioning'),
        isRestDay: sched ? sched.isRestDay : i === 0,
        exercises,
      };
    }

    setConfig((prev) => ({
      ...prev,
      physicalPath: 'custom',
      selectedTemplateId: templateId,
      customWeeklySplit: newSplit,
    }));

    toast.success(`Loaded "${template.name}" template into your weekly split.`);
  };

  const handleTogglePhysicalPath = (path: 'system' | 'custom') => {
    systemSound.playClick();
    setConfig((prev) => ({
      ...prev,
      physicalPath: path,
    }));
  };

  const handleUpdateDayFocus = (focus: string) => {
    setConfig((prev) => {
      const updatedDay: CustomDayPlan = {
        ...currentDayPlan,
        focus,
      };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: updatedDay,
        },
      };
    });
  };

  const handleToggleRestDay = () => {
    systemSound.playClick();
    setConfig((prev) => {
      const nextRest = !currentDayPlan.isRestDay;
      const updatedDay: CustomDayPlan = {
        ...currentDayPlan,
        isRestDay: nextRest,
        focus: nextRest ? 'Rest & Recovery' : currentDayPlan.focus === 'Rest & Recovery' ? 'Conditioning' : currentDayPlan.focus,
      };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: updatedDay,
        },
      };
    });
  };

  const handleAddExerciseFromLibrary = (def: ExerciseDefinition) => {
    systemSound.playClick();
    setConfig((prev) => {
      const exists = currentDayPlan.exercises.some((e) => e.name.toLowerCase() === def.name.toLowerCase());
      if (exists) {
        toast.info(`${def.name} is already in today's split.`);
        return prev;
      }
      const newEx: CustomDayExercise = {
        id: def.id,
        name: def.name,
        kind: def.kind,
        targetSets: def.defaultSets,
        targetReps: def.defaultReps,
        targetMinutes: def.defaultMinutes,
        category: def.category,
      };
      const updatedDay: CustomDayPlan = {
        ...currentDayPlan,
        isRestDay: false,
        exercises: [...currentDayPlan.exercises, newEx],
      };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: updatedDay,
        },
      };
    });
    toast.success(`Added ${def.name} to ${DAY_NAMES[selectedDayIndex]}`);
  };

  const handleAddCustomExercise = () => {
    if (!customExerciseName.trim()) return;
    systemSound.playClick();
    const name = customExerciseName.trim();
    const newEx: CustomDayExercise = {
      name,
      kind: 'strength',
      targetSets: 3,
      targetReps: '8-12',
    };
    setConfig((prev) => {
      const updatedDay: CustomDayPlan = {
        ...currentDayPlan,
        isRestDay: false,
        exercises: [...currentDayPlan.exercises, newEx],
      };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: updatedDay,
        },
      };
    });
    setCustomExerciseName('');
    toast.success(`Added "${name}" to ${DAY_NAMES[selectedDayIndex]}`);
  };

  const handleRemoveExercise = (idx: number) => {
    systemSound.playClick();
    setConfig((prev) => {
      const nextExercises = currentDayPlan.exercises.filter((_, i) => i !== idx);
      const updatedDay: CustomDayPlan = {
        ...currentDayPlan,
        exercises: nextExercises,
      };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: updatedDay,
        },
      };
    });
  };

  const handleUpdateExerciseSets = (idx: number, sets: number) => {
    setConfig((prev) => {
      const nextExercises = [...currentDayPlan.exercises];
      nextExercises[idx] = { ...nextExercises[idx], targetSets: Math.max(1, sets) };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: { ...currentDayPlan, exercises: nextExercises },
        },
      };
    });
  };

  const handleUpdateExerciseReps = (idx: number, reps: string) => {
    setConfig((prev) => {
      const nextExercises = [...currentDayPlan.exercises];
      nextExercises[idx] = { ...nextExercises[idx], targetReps: reps };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: { ...currentDayPlan, exercises: nextExercises },
        },
      };
    });
  };

  const handleUpdateExerciseKind = (idx: number, kind: PhysicalLogRowKind) => {
    setConfig((prev) => {
      const nextExercises = [...currentDayPlan.exercises];
      nextExercises[idx] = { ...nextExercises[idx], kind };
      return {
        ...prev,
        customWeeklySplit: {
          ...prev.customWeeklySplit,
          [selectedDayIndex]: { ...currentDayPlan, exercises: nextExercises },
        },
      };
    });
  };

  const handleSave = () => {
    systemSound.playLevelUp();
    saveHunterProtocolConfig(config);
    saveUserBodyMetrics(bodyMetrics);
    // Asynchronously refresh nutrition plan with newly calibrated metrics
    try {
      const p = getUserProfile();
      generateNutritionPlan(p).then((fresh) => {
        saveNutritionLog({ date: fresh.date, mealsDone: [], waterDone: false, claimed: false });
      });
    } catch {}
    toast.success('Hunter Protocol calibrated successfully.');
    if (onSaved) onSaved();
    onClose();
  };

  const handleResetToSystem = () => {
    systemSound.playSystemChime();
    resetHunterProtocolToSystem();
    setConfig(getHunterProtocolConfig());
    toast.info('Protocol reset to System Prescribed default.');
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-card border border-primary/40 shadow-2xl rounded-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/30 bg-primary/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
              <SlidersHorizontal className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-mono font-bold tracking-wider text-primary uppercase">
                  Hunter Protocol Calibration
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                  SOLO LEVELING SYSTEM
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure your physical gym regimen and intellectual focus targets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation */}
        <div className="flex border-b border-border bg-muted/40 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveSection('physical')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-mono font-semibold border-b-2 transition-all ${
              activeSection === 'physical'
                ? 'border-primary text-primary bg-primary/10 rounded-t'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Dumbbell className="w-4 h-4" />
            Physical Conditioning Regimen
          </button>
          <button
            onClick={() => setActiveSection('mental')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-mono font-semibold border-b-2 transition-all ${
              activeSection === 'mental'
                ? 'border-primary text-primary bg-primary/10 rounded-t'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Mental Reading & Disciplines
          </button>
          <button
            onClick={() => setActiveSection('nutrition')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-mono font-semibold border-b-2 transition-all ${
              activeSection === 'nutrition'
                ? 'border-primary text-primary bg-primary/10 rounded-t'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-4 h-4" />
            Nutritional Biometrics & IMC
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeSection === 'physical' ? (
            <div className="space-y-6">
              {/* Path Switcher */}
              <div className="bg-muted/30 border border-border p-4 rounded-lg">
                <div className="text-xs font-mono font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Select Your Conditioning Protocol Path
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTogglePhysicalPath('system')}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      config.physicalPath === 'system'
                        ? 'border-primary bg-primary/15 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-primary'
                        : 'border-border bg-card/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-mono font-bold text-sm text-foreground">
                        <Shield className="w-4 h-4 text-primary" />
                        System Prescribed Plan
                      </div>
                      {config.physicalPath === 'system' && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Zero setup needed. The System prescribes balanced daily workouts (Gym Strength, Cardio, Mobility) tailored to Hunter attributes.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePhysicalPath('custom')}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      config.physicalPath === 'custom'
                        ? 'border-primary bg-primary/15 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-primary'
                        : 'border-border bg-card/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-mono font-bold text-sm text-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Awakened Custom Regimen
                      </div>
                      {config.physicalPath === 'custom' && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      For gym-goers with their own routine. Customize your weekly split, choose from 120+ gym exercises, or load popular splits.
                    </p>
                  </button>
                </div>
              </div>

              {/* Custom Regimen Builder (Visible if custom selected) */}
              {config.physicalPath === 'custom' && (
                <div className="space-y-5">
                  {/* Preset Split Fast-Loader */}
                  <div className="bg-muted/20 border border-border p-3.5 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Quick-Load Popular Split Templates:
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {PRESET_SPLIT_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => handleApplyPresetTemplate(tmpl.id)}
                          className={`px-3 py-2 text-left rounded border text-xs transition-all ${
                            config.selectedTemplateId === tmpl.id
                              ? 'border-primary/60 bg-primary/10 text-foreground font-semibold'
                              : 'border-border/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div className="font-mono text-xs text-foreground truncate">
                            {tmpl.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {tmpl.daysPerWeek} Days/wk • {tmpl.level}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 7-Day Week Tabs */}
                  <div className="space-y-3">
                    <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                      Weekly Schedule (Select Day to Configure)
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {DAY_ORDER.map((dayIdx) => {
                        const dayPlan = config.customWeeklySplit[dayIdx];
                        const isSelected = selectedDayIndex === dayIdx;
                        return (
                          <button
                            key={dayIdx}
                            type="button"
                            onClick={() => {
                              setSelectedDayIndex(dayIdx);
                              systemSound.playClick();
                            }}
                            className={`p-2 rounded border text-center transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/20 text-primary font-bold shadow-sm'
                                : 'border-border bg-card/60 hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            <div className="text-[11px] font-mono font-bold uppercase">
                              {DAY_NAMES[dayIdx].slice(0, 3)}
                            </div>
                            <div className="text-[10px] truncate mt-0.5">
                              {dayPlan?.isRestDay ? (
                                <span className="text-emerald-400">Rest</span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {dayPlan?.exercises?.length || 0} ex
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Day Configuration Card */}
                  <div className="border border-border bg-card/80 p-4 rounded-lg space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/15 text-primary flex items-center justify-center font-mono font-bold text-xs">
                          {DAY_NAMES[selectedDayIndex].slice(0, 3)}
                        </div>
                        <div>
                          <h3 className="font-mono font-bold text-sm text-foreground">
                            {DAY_NAMES[selectedDayIndex]} Conditioning Setup
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {currentDayPlan.isRestDay
                              ? 'Designated Recovery Day. Light mobility or full rest.'
                              : `${currentDayPlan.exercises.length} exercises programmed for this session.`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleRestDay}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold border transition-all ${
                            currentDayPlan.isRestDay
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          <Bed className="w-3.5 h-3.5" />
                          {currentDayPlan.isRestDay ? 'Rest Day Active' : 'Mark as Rest Day'}
                        </button>
                      </div>
                    </div>

                    {!currentDayPlan.isRestDay ? (
                      <div className="space-y-4">
                        {/* Day Focus Name */}
                        <div>
                          <label className="text-xs font-mono text-muted-foreground block mb-1">
                            Session Focus / Muscle Groups
                          </label>
                          <input
                            type="text"
                            value={currentDayPlan.focus}
                            onChange={(e) => handleUpdateDayFocus(e.target.value)}
                            placeholder="e.g., Push (Chest, Shoulders, Triceps), Leg Day..."
                            className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                          />
                        </div>

                        {/* Exercise Checklist */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-muted-foreground font-semibold">
                              Exercises ({currentDayPlan.exercises.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLibraryOpen(true);
                                systemSound.playClick();
                              }}
                              className="flex items-center gap-1 text-xs font-mono text-primary hover:underline"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add from Library (120+ Exercises)
                            </button>
                          </div>

                          {currentDayPlan.exercises.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-border/80 rounded-lg">
                              <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                              <p className="text-xs text-muted-foreground">
                                No exercises added for {DAY_NAMES[selectedDayIndex]} yet.
                              </p>
                              <button
                                type="button"
                                onClick={() => setLibraryOpen(true)}
                                className="mt-3 px-3 py-1.5 bg-primary/20 text-primary border border-primary/40 rounded text-xs font-mono hover:bg-primary/30 transition-all inline-flex items-center gap-1.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Browse Exercise Library
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {currentDayPlan.exercises.map((ex, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded border border-border/70 bg-card hover:border-primary/40 transition-all gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-muted-foreground w-5 text-center">
                                      {idx + 1}.
                                    </span>
                                    <div>
                                      <div className="font-mono text-xs font-bold text-foreground">
                                        {ex.name}
                                      </div>
                                      {ex.category && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {ex.category}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <div className="flex items-center gap-1 text-xs font-mono">
                                      <span className="text-muted-foreground text-[11px]">Sets:</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={ex.targetSets || 3}
                                        onChange={(e) =>
                                          handleUpdateExerciseSets(idx, parseInt(e.target.value, 10) || 3)
                                        }
                                        className="w-12 bg-background border border-border rounded px-1.5 py-0.5 text-xs text-center font-mono text-foreground"
                                      />
                                    </div>

                                    <div className="flex items-center gap-1 text-xs font-mono">
                                      <span className="text-muted-foreground text-[11px]">Reps:</span>
                                      <input
                                        type="text"
                                        value={ex.targetReps || '8-10'}
                                        onChange={(e) => handleUpdateExerciseReps(idx, e.target.value)}
                                        className="w-16 bg-background border border-border rounded px-1.5 py-0.5 text-xs text-center font-mono text-foreground"
                                        placeholder="e.g. 8-10"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExercise(idx)}
                                      className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors"
                                      title="Remove exercise"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Quick Custom Exercise Adder */}
                          <div className="pt-2 flex gap-2">
                            <input
                              type="text"
                              value={customExerciseName}
                              onChange={(e) => setCustomExerciseName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomExercise();
                                }
                              }}
                              placeholder="Or type a custom exercise name..."
                              className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomExercise}
                              className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded text-xs font-mono flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center border border-dashed border-emerald-500/30 rounded-lg bg-emerald-950/10 space-y-2">
                        <Bed className="w-8 h-8 text-emerald-400 mx-auto" />
                        <h4 className="font-mono text-sm font-bold text-emerald-400">
                          Scheduled Rest & Active Recovery Day
                        </h4>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                          The System acknowledges the necessity of muscular recovery and nervous system restoration. Completing your rest day verification will award Vitality (+VIT) and Hunter EXP.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeSection === 'mental' ? (
            /* Mental Focus Configuration */
            <div className="space-y-5">
              <div className="bg-muted/30 border border-border p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h3 className="font-mono font-bold text-sm text-foreground uppercase tracking-wider">
                    Intellectual & Study Focus Protocol
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The Solo Leveling System adapts your Daily Mental Quests to your current reading material and areas of real-world study.
                </p>

                {/* Active Reading Book */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-mono font-bold text-foreground block">
                    1. Active Book Reading Goal
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] font-mono text-muted-foreground block mb-1">
                        Current Book Title
                      </span>
                      <input
                        type="text"
                        value={config.mentalPreferences.currentBookTitle}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            mentalPreferences: {
                              ...prev.mentalPreferences,
                              currentBookTitle: e.target.value,
                            },
                          }))
                        }
                        placeholder="e.g., Atomic Habits, Meditations..."
                        className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-muted-foreground block mb-1">
                        Author (Optional)
                      </span>
                      <input
                        type="text"
                        value={config.mentalPreferences.currentBookAuthor || ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            mentalPreferences: {
                              ...prev.mentalPreferences,
                              currentBookAuthor: e.target.value,
                            },
                          }))
                        }
                        placeholder="e.g., James Clear, Marcus Aurelius..."
                        className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-muted-foreground block mb-1">
                      Daily Reading Target (Minutes)
                    </span>
                    <div className="flex items-center gap-2">
                      {[15, 20, 30, 45].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              mentalPreferences: {
                                ...prev.mentalPreferences,
                                dailyReadingMinutes: mins,
                              },
                            }))
                          }
                          className={`px-3 py-1 rounded border text-xs font-mono transition-all ${
                            config.mentalPreferences.dailyReadingMinutes === mins
                              ? 'border-primary bg-primary/20 text-primary font-bold'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {mins} mins
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Study Discipline */}
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <label className="text-xs font-mono font-bold text-foreground block">
                    2. Primary Discipline & Field of Study
                  </label>
                  <div>
                    <span className="text-[11px] font-mono text-muted-foreground block mb-1">
                      Field or Topic Name
                    </span>
                    <input
                      type="text"
                      value={config.mentalPreferences.currentStudyTopic}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          mentalPreferences: {
                            ...prev.mentalPreferences,
                            currentStudyTopic: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., Software Engineering, Modern History, Philosophy, Mathematics..."
                      className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-muted-foreground block mb-1">
                      Daily Study Target (Minutes)
                    </span>
                    <div className="flex items-center gap-2">
                      {[15, 30, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              mentalPreferences: {
                                ...prev.mentalPreferences,
                                dailyStudyMinutes: mins,
                              },
                            }))
                          }
                          className={`px-3 py-1 rounded border text-xs font-mono transition-all ${
                            config.mentalPreferences.dailyStudyMinutes === mins
                              ? 'border-primary bg-primary/20 text-primary font-bold'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {mins} mins
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* NUTRITION & BIOMETRICS CALIBRATION PANEL */
            /* ============================================================ */
            (() => {
              const imc = calculateIMC(bodyMetrics.weightKg, bodyMetrics.heightCm);
              const t = calculateEnergyAndMacros(bodyMetrics);

              return (
                <div className="space-y-6">
                  {/* Hero IMC Readout */}
                  <div
                    className="p-4 rounded-lg border transition-all"
                    style={{ borderColor: imc.color, backgroundColor: imc.badgeBg }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="px-3.5 py-1.5 border rounded font-black text-2xl tracking-wider"
                          style={{ borderColor: imc.color, color: imc.color }}
                        >
                          {imc.imc}
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
                            Indice de Masse Corporelle (IMC / BMI)
                          </div>
                          <div className="font-extrabold text-sm tracking-wider" style={{ color: imc.color }}>
                            {imc.label}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="px-2.5 py-1 bg-black/40 border border-border rounded text-foreground">
                          Target: {t.calories} kcal
                        </span>
                        <span className="px-2.5 py-1 bg-black/40 border border-border rounded text-emerald-400">
                          Protein: {t.protein}g
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-foreground/80 leading-relaxed">{imc.description}</p>
                  </div>

                  {/* Weight, Height, Age, Gender Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-muted/30 border border-border p-4 rounded-lg">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold mb-2">
                        <span className="flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-primary" /> Body Weight
                        </span>
                        <span className="text-primary font-bold">{bodyMetrics.weightKg} kg</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="180"
                        step="0.5"
                        value={bodyMetrics.weightKg}
                        onChange={(e) =>
                          setBodyMetrics((prev) => ({ ...prev, weightKg: parseFloat(e.target.value) || 70 }))
                        }
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="bg-muted/30 border border-border p-4 rounded-lg">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold mb-2">
                        <span className="flex items-center gap-1.5">
                          <Ruler className="w-4 h-4 text-primary" /> Body Height
                        </span>
                        <span className="text-primary font-bold">{bodyMetrics.heightCm} cm</span>
                      </div>
                      <input
                        type="range"
                        min="130"
                        max="220"
                        step="1"
                        value={bodyMetrics.heightCm}
                        onChange={(e) =>
                          setBodyMetrics((prev) => ({ ...prev, heightCm: parseInt(e.target.value, 10) || 175 }))
                        }
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="bg-muted/30 border border-border p-4 rounded-lg">
                      <div className="text-xs font-mono font-semibold mb-2">Biological Baseline</div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['male', 'female', 'other'] as BiologicalSex[]).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setBodyMetrics((prev) => ({ ...prev, gender: g }))}
                            className={`py-1.5 text-xs font-mono font-semibold rounded border transition-all uppercase ${
                              bodyMetrics.gender === g
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-muted/30 border border-border p-4 rounded-lg">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold mb-2">
                        <span>Hunter Age</span>
                        <span className="text-primary font-bold">{bodyMetrics.age || 24} yrs</span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="70"
                        value={bodyMetrics.age || 24}
                        onChange={(e) =>
                          setBodyMetrics((prev) => ({ ...prev, age: parseInt(e.target.value, 10) || 24 }))
                        }
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Dietary Goal */}
                  <div className="bg-muted/30 border border-border p-4 rounded-lg">
                    <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Dietary Intake Objective
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { id: 'bulk', label: 'LEAN BULK', desc: 'Muscular hypertrophy & recovery (+350 kcal)' },
                        { id: 'recomp', label: 'RECOMPOSITION', desc: 'Iso-caloric fat loss & muscle density (-100 kcal)' },
                        { id: 'cut', label: 'CUTTING / SHRED', desc: 'Precision deficit to reveal muscle definition (-450 kcal)' },
                        { id: 'maintain', label: 'MAINTENANCE', desc: 'Athletic equilibrium & sustained stamina (±0 kcal)' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setBodyMetrics((prev) => ({ ...prev, dietaryGoal: g.id as DietaryGoal }))}
                          className={`p-3 rounded border text-left transition-all ${
                            bodyMetrics.dietaryGoal === g.id
                              ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                              : 'bg-muted/20 border-border text-muted-foreground hover:border-foreground/30'
                          }`}
                        >
                          <div className="font-bold text-xs text-foreground">{g.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{g.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-border bg-muted/40 gap-3">
          <button
            type="button"
            onClick={handleResetToSystem}
            className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default System Plan
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {isOnboarding && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-mono text-muted-foreground hover:text-foreground border border-border rounded"
              >
                Skip Calibration
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-md flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save & Calibrate Protocol
            </button>
          </div>
        </div>
      </div>

      {/* Exercise Library Modal Drawer */}
      {libraryOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-card border border-primary/50 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            {/* Library Header */}
            <div className="px-5 py-3.5 border-b border-border bg-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-mono font-bold text-primary uppercase tracking-wider">
                  Exercise Library (120+ Exercises)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-border bg-muted/20 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search exercise by name, muscle, or movement cue..."
                  className="w-full bg-background border border-border rounded pl-9 pr-4 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Muscle Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-all ${
                    selectedCategory === 'All'
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {EXERCISE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Exercises List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-border/60">
              {filteredExercises.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs font-mono">
                  No exercises found matching your filter criteria.
                </div>
              ) : (
                filteredExercises.map((def) => {
                  const isAdded = currentDayPlan.exercises.some(
                    (e) => e.name.toLowerCase() === def.name.toLowerCase()
                  );
                  return (
                    <div
                      key={def.id}
                      className="py-3 flex items-start sm:items-center justify-between gap-3 hover:bg-muted/20 px-2 rounded transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {def.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                            +{def.attribute}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{def.category}</span>
                          <span>•</span>
                          <span>{def.equipment}</span>
                          <span>•</span>
                          <span className="text-foreground/70">{def.primaryMuscle}</span>
                        </div>
                        {def.cue && (
                          <p className="text-[10px] text-muted-foreground/80 italic font-mono pt-0.5">
                            Form: {def.cue}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => handleAddExerciseFromLibrary(def)}
                        className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all shrink-0 flex items-center gap-1 ${
                          isAdded
                            ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                            : 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Added
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Add
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Library Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/40 flex justify-between items-center text-xs font-mono text-muted-foreground">
              <span>Showing {filteredExercises.length} exercises</span>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-mono font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
