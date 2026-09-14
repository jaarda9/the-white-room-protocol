import { useState, useMemo } from 'react';
import {
  HunterProtocolConfig,
  getHunterProtocolConfig,
  saveHunterProtocolConfig,
  resetHunterProtocolToSystem,
  CustomDayPlan,
  CustomDayExercise,
} from '@/lib/storage';
import {
  EXERCISE_CATEGORIES,
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
  SlidersHorizontal,
  Shield,
  Bed,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

interface ProtocolCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Login onboarding already collects the two core mental-focus fields inline, so the Mental
   * tab is hidden here in that context to avoid asking for the same thing twice. */
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
  const [activeSection, setActiveSection] = useState<'physical' | 'mental'>('physical');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1); // Monday default
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Exercise library search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'All'>('All');
  const [selectedEquipment] = useState<ExerciseEquipment | 'All'>('All');
  const [customExerciseName, setCustomExerciseName] = useState('');

  const filteredExercises = useMemo(() => {
    return searchExercises(searchQuery, selectedCategory, selectedEquipment);
  }, [searchQuery, selectedCategory, selectedEquipment]);

  // Covers the nested exercise-library picker too — it only ever opens while this modal is
  // already open, so a single lock at this level is sufficient (stacking a second lock/unlock
  // on the sub-panel risks prematurely restoring scroll if it closes before this modal does).
  useLockBodyScroll(isOpen);

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

  const handleSave = () => {
    systemSound.playLevelUp();
    saveHunterProtocolConfig(config);
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
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in font-mono">
      <div className="relative w-full max-w-3xl bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] font-mono anime-dropdown max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#9fd3ff]" />
              <span className="font-mono font-extrabold tracking-[0.24em] text-sm sm:text-base text-white anime-glow-text">
                PROTOCOL CALIBRATION
              </span>
            </div>
            <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">
              [PHYSICAL & MENTAL DIRECTIVES]
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

        {/* Section Navigation */}
        <div className="flex border-b border-white/15 px-4 sm:px-5 pt-2.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              setActiveSection('physical');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] sm:text-xs font-mono font-bold tracking-wider border-b-2 transition-all ${
              activeSection === 'physical'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            PHYSICAL REGIMEN
          </button>
          {!isOnboarding && (
            <button
              type="button"
              onClick={() => {
                systemSound.playClick();
                setActiveSection('mental');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] sm:text-xs font-mono font-bold tracking-wider border-b-2 transition-all ${
                activeSection === 'mental'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-white/50 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              MENTAL DISCIPLINE
            </button>
          )}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {activeSection === 'physical' ? (
            <div className="space-y-4">
              {/* Path Switcher */}
              <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-3">
                <div className="text-[10px] font-bold text-[#9fd3ff] mb-2.5 uppercase tracking-wider">
                  SELECT CONDITIONING PROTOCOL PATH
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTogglePhysicalPath('system')}
                    className={`p-3 rounded-[2px] border text-left transition-all ${
                      config.physicalPath === 'system'
                        ? 'border-cyan-400 bg-cyan-950/80 shadow-[0_0_10px_rgba(0,212,255,0.35)]'
                        : 'border-white/20 bg-black/40 hover:border-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        SYSTEM PRESCRIBED PLAN
                      </div>
                      {config.physicalPath === 'system' && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      Zero setup needed. The System prescribes balanced daily workouts tailored to Hunter attributes.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePhysicalPath('custom')}
                    className={`p-3 rounded-[2px] border text-left transition-all ${
                      config.physicalPath === 'custom'
                        ? 'border-cyan-400 bg-cyan-950/80 shadow-[0_0_10px_rgba(0,212,255,0.35)]'
                        : 'border-white/20 bg-black/40 hover:border-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        AWAKENED CUSTOM REGIMEN
                      </div>
                      {config.physicalPath === 'custom' && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      For gym-goers with their own routine. Build a weekly split from 120+ exercises or load a preset.
                    </p>
                  </button>
                </div>
              </div>

              {/* Custom Regimen Builder (Visible if custom selected) */}
              {config.physicalPath === 'custom' && (
                <div className="space-y-3.5">
                  {/* Preset Split Fast-Loader */}
                  <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-3 space-y-2">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      QUICK-LOAD POPULAR SPLIT TEMPLATES
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                      {PRESET_SPLIT_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => handleApplyPresetTemplate(tmpl.id)}
                          className={`px-2.5 py-2 text-left rounded-[2px] border text-xs transition-all ${
                            config.selectedTemplateId === tmpl.id
                              ? 'border-cyan-400/60 bg-cyan-950/50 text-white font-semibold'
                              : 'border-white/20 bg-black/30 hover:border-white/40 text-white/60 hover:text-white'
                          }`}
                        >
                          <div className="font-mono text-[11px] text-white truncate">{tmpl.name}</div>
                          <div className="text-[9px] text-white/50">
                            {tmpl.daysPerWeek} Days/wk • {tmpl.level}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 7-Day Week Tabs */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-[#9fd3ff] uppercase tracking-wider">
                      WEEKLY SCHEDULE (SELECT DAY TO CONFIGURE)
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
                            className={`p-1.5 rounded-[2px] border text-center transition-all ${
                              isSelected
                                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold shadow-[0_0_8px_rgba(0,212,255,0.35)]'
                                : 'border-white/20 bg-black/30 hover:border-white/40 text-white/50'
                            }`}
                          >
                            <div className="text-[10px] font-mono font-bold uppercase">
                              {DAY_NAMES[dayIdx].slice(0, 3)}
                            </div>
                            <div className="text-[9px] truncate mt-0.5">
                              {dayPlan?.isRestDay ? (
                                <span className="text-emerald-400">Rest</span>
                              ) : (
                                <span className="text-white/40">{dayPlan?.exercises?.length || 0} ex</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Day Configuration Card */}
                  <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/15">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-[2px] border border-white/25 bg-black/60 text-cyan-300 flex items-center justify-center font-mono font-bold text-[10px]">
                          {DAY_NAMES[selectedDayIndex].slice(0, 3)}
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-white">
                            {DAY_NAMES[selectedDayIndex]} Conditioning Setup
                          </h3>
                          <p className="text-[10px] text-white/50">
                            {currentDayPlan.isRestDay
                              ? 'Designated Recovery Day. Light mobility or full rest.'
                              : `${currentDayPlan.exercises.length} exercises programmed for this session.`}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleRestDay}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] text-[10px] font-bold border transition-all shrink-0 ${
                          currentDayPlan.isRestDay
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                            : 'bg-black/40 text-white/60 border-white/20 hover:text-white'
                        }`}
                      >
                        <Bed className="w-3.5 h-3.5" />
                        {currentDayPlan.isRestDay ? 'REST DAY ACTIVE' : 'MARK AS REST DAY'}
                      </button>
                    </div>

                    {!currentDayPlan.isRestDay ? (
                      <div className="space-y-3">
                        {/* Day Focus Name */}
                        <div>
                          <label className="text-[10px] text-white/50 block mb-1">
                            SESSION FOCUS / MUSCLE GROUPS
                          </label>
                          <input
                            type="text"
                            value={currentDayPlan.focus}
                            onChange={(e) => handleUpdateDayFocus(e.target.value)}
                            placeholder="e.g., Push (Chest, Shoulders, Triceps), Leg Day..."
                            className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                          />
                        </div>

                        {/* Exercise Checklist */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white/60 font-bold">
                              EXERCISES ({currentDayPlan.exercises.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLibraryOpen(true);
                                systemSound.playClick();
                              }}
                              className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-1 rounded-[2px] transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              ADD FROM LIBRARY (120+)
                            </button>
                          </div>

                          {currentDayPlan.exercises.length === 0 ? (
                            <div className="text-center py-6 border border-dashed border-white/20 rounded-[2px]">
                              <Dumbbell className="w-6 h-6 text-white/30 mx-auto mb-2" />
                              <p className="text-[10px] text-white/50">
                                No exercises added for {DAY_NAMES[selectedDayIndex]} yet.
                              </p>
                              <button
                                type="button"
                                onClick={() => setLibraryOpen(true)}
                                className="mt-2.5 px-2.5 py-1.5 bg-cyan-950/50 text-cyan-300 border border-cyan-400/50 rounded-[2px] text-[10px] font-bold hover:bg-cyan-900/60 transition-all inline-flex items-center gap-1.5"
                              >
                                <Plus className="w-3 h-3" />
                                BROWSE EXERCISE LIBRARY
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {currentDayPlan.exercises.map((ex, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-[2px] border border-white/20 bg-black/30 hover:border-cyan-400/40 transition-all gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-white/40 w-5 text-center">{idx + 1}.</span>
                                    <div>
                                      <div className="text-xs font-bold text-white">{ex.name}</div>
                                      {ex.category && (
                                        <span className="text-[9px] text-white/40">{ex.category}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className="text-white/40">Sets:</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={ex.targetSets || 3}
                                        onChange={(e) =>
                                          handleUpdateExerciseSets(idx, parseInt(e.target.value, 10) || 3)
                                        }
                                        className="w-11 bg-black/60 border border-white/30 rounded-[2px] px-1 py-0.5 text-center text-white"
                                      />
                                    </div>

                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className="text-white/40">Reps:</span>
                                      <input
                                        type="text"
                                        value={ex.targetReps || '8-10'}
                                        onChange={(e) => handleUpdateExerciseReps(idx, e.target.value)}
                                        className="w-14 bg-black/60 border border-white/30 rounded-[2px] px-1 py-0.5 text-center text-white"
                                        placeholder="8-10"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExercise(idx)}
                                      className="text-white/40 hover:text-rose-400 p-1 rounded-[2px] transition-colors"
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
                          <div className="pt-1.5 flex gap-2">
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
                              className="flex-1 bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomExercise}
                              className="px-2.5 py-1.5 bg-black/40 hover:bg-white/10 text-white border border-white/30 rounded-[2px] text-[10px] font-bold flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              ADD
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center border border-dashed border-emerald-500/30 rounded-[2px] bg-emerald-950/10 space-y-1.5">
                        <Bed className="w-6 h-6 text-emerald-400 mx-auto" />
                        <h4 className="text-xs font-bold text-emerald-300">
                          SCHEDULED REST & ACTIVE RECOVERY DAY
                        </h4>
                        <p className="text-[10px] text-white/50 max-w-md mx-auto leading-relaxed">
                          The System acknowledges the necessity of muscular recovery. Verifying your rest day awards Vitality (+VIT) and Hunter EXP.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Mental Focus Configuration */
            <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-3 space-y-3.5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Intellectual & Study Focus Protocol
                </h3>
              </div>
              <p className="text-[10px] text-white/50 leading-relaxed">
                The System adapts your Daily Mental Quests to your current reading material and area of study.
              </p>

              {/* Active Reading Book */}
              <div className="space-y-2.5 pt-1">
                <label className="text-[10px] font-bold text-white block">1. ACTIVE BOOK READING GOAL</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-white/50 block mb-1">Current Book Title</span>
                    <input
                      type="text"
                      value={config.mentalPreferences.currentBookTitle}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          mentalPreferences: { ...prev.mentalPreferences, currentBookTitle: e.target.value },
                        }))
                      }
                      placeholder="e.g., Atomic Habits, Meditations..."
                      className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-white/50 block mb-1">Author (Optional)</span>
                    <input
                      type="text"
                      value={config.mentalPreferences.currentBookAuthor || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          mentalPreferences: { ...prev.mentalPreferences, currentBookAuthor: e.target.value },
                        }))
                      }
                      placeholder="e.g., James Clear, Marcus Aurelius..."
                      className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-white/50 block mb-1">Daily Reading Target (Minutes)</span>
                  <div className="flex items-center gap-1.5">
                    {[15, 20, 30, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            mentalPreferences: { ...prev.mentalPreferences, dailyReadingMinutes: mins },
                          }))
                        }
                        className={`px-2.5 py-1 rounded-[2px] border text-[11px] transition-all ${
                          config.mentalPreferences.dailyReadingMinutes === mins
                            ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold'
                            : 'border-white/20 bg-black/30 text-white/50 hover:text-white'
                        }`}
                      >
                        {mins} mins
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary Study Discipline */}
              <div className="space-y-2.5 pt-3 border-t border-white/15">
                <label className="text-[10px] font-bold text-white block">2. PRIMARY DISCIPLINE & FIELD OF STUDY</label>
                <div>
                  <span className="text-[10px] text-white/50 block mb-1">Field or Topic Name</span>
                  <input
                    type="text"
                    value={config.mentalPreferences.currentStudyTopic}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        mentalPreferences: { ...prev.mentalPreferences, currentStudyTopic: e.target.value },
                      }))
                    }
                    placeholder="e.g., Software Engineering, Modern History, Philosophy..."
                    className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-white/50 block mb-1">Daily Study Target (Minutes)</span>
                  <div className="flex items-center gap-1.5">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            mentalPreferences: { ...prev.mentalPreferences, dailyStudyMinutes: mins },
                          }))
                        }
                        className={`px-2.5 py-1 rounded-[2px] border text-[11px] transition-all ${
                          config.mentalPreferences.dailyStudyMinutes === mins
                            ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold'
                            : 'border-white/20 bg-black/30 text-white/50 hover:text-white'
                        }`}
                      >
                        {mins} mins
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-5 py-3 border-t border-white/15 gap-2.5">
          <button
            type="button"
            onClick={handleResetToSystem}
            className="text-[11px] text-white/50 hover:text-white flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET TO DEFAULT SYSTEM PLAN
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isOnboarding && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-[11px] text-white/60 hover:text-white border border-white/20 rounded-[2px]"
              >
                SKIP CALIBRATION
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider transition-all shadow-[0_0_14px_rgba(0,212,255,0.4)] flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              [ SAVE & CALIBRATE PROTOCOL ]
            </button>
          </div>
        </div>
      </div>

      {/* Exercise Library Modal Drawer */}
      {libraryOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] shadow-[0_0_35px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[88vh] font-mono">
            {/* Library Header */}
            <div className="px-4 sm:px-5 py-3 border-b border-white/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  EXERCISE LIBRARY (120+)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-3.5 border-b border-white/15 space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search exercise by name, muscle, or movement cue..."
                  className="w-full bg-black/60 border border-white/30 rounded-[2px] pl-8 pr-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Muscle Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className={`px-2.5 py-1 rounded-[2px] text-[10px] whitespace-nowrap transition-all border ${
                    selectedCategory === 'All'
                      ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold'
                      : 'border-white/20 bg-black/30 text-white/50 hover:text-white'
                  }`}
                >
                  All
                </button>
                {EXERCISE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-[2px] text-[10px] whitespace-nowrap transition-all border ${
                      selectedCategory === cat
                        ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold'
                        : 'border-white/20 bg-black/30 text-white/50 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Exercises List */}
            <div className="flex-1 overflow-y-auto p-3.5 divide-y divide-white/10">
              {filteredExercises.length === 0 ? (
                <div className="text-center py-10 text-white/40 text-xs">
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
                      className="py-2.5 flex items-start sm:items-center justify-between gap-3 hover:bg-white/5 px-2 rounded-[2px] transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{def.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-[2px] bg-cyan-950/50 text-cyan-300 border border-cyan-400/30">
                            +{def.attribute}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/40 flex items-center gap-1.5 flex-wrap">
                          <span>{def.category}</span>
                          <span>•</span>
                          <span>{def.equipment}</span>
                          <span>•</span>
                          <span className="text-white/60">{def.primaryMuscle}</span>
                        </div>
                        {def.cue && (
                          <p className="text-[9px] text-white/35 italic pt-0.5">Form: {def.cue}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => handleAddExerciseFromLibrary(def)}
                        className={`px-2.5 py-1.5 rounded-[2px] text-[10px] font-bold transition-all shrink-0 flex items-center gap-1 border ${
                          isAdded
                            ? 'bg-black/30 text-white/30 cursor-not-allowed border-white/15'
                            : 'bg-cyan-950/50 text-cyan-300 hover:bg-cyan-900/60 border-cyan-400/40'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3 h-3" /> ADDED
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> ADD
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Library Footer */}
            <div className="px-4 sm:px-5 py-2.5 border-t border-white/15 flex justify-between items-center text-[10px] text-white/50">
              <span>Showing {filteredExercises.length} exercises</span>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="px-3 py-1.5 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[10px] font-bold"
              >
                [ DONE ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
