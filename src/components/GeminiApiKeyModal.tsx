import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile } from '@/lib/types';
import {
  getUserGeminiKeys,
  addUserGeminiApiKey,
  removeUserGeminiApiKey,
  updateUserGeminiApiKey,
  reorderUserGeminiApiKeys,
  clearAllUserGeminiApiKeys,
  resetGeminiKeyCooldown,
  getGeminiRotationMode,
  setGeminiRotationMode,
} from '@/lib/storage';
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { systemSound } from '@/lib/system-sound';
import {
  X,
  KeyRound,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Info,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaved?: (updatedProfile: UserProfile) => void;
}

const GEMINI_STEPS = [
  { label: 'Open Google AI Studio', detail: 'aistudio.google.com/apikey — link below' },
  { label: 'Sign in with any Google account', detail: 'Free tier — no credit card needed' },
  { label: 'Click "Create API key"', detail: 'Generates a free Gemini quota key' },
  { label: 'Add multiple keys if desired', detail: 'Combine keys across accounts for multiplied limits' },
];

export default function GeminiApiKeyModal({ isOpen, onClose, profile, onSaved }: Props) {
  const [keyInput, setKeyInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showStrategyDetails, setShowStrategyDetails] = useState(false);
  const [, setTimerTick] = useState(0);

  useLockBodyScroll(isOpen);

  // Periodic re-render every 3 seconds to update active cooldown countdowns & cursor
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentKeys = getUserGeminiKeys(profile);
  const activeKeys = currentKeys.filter((k) => k.isActive !== false && k.status === 'active');
  const coolingKeys = currentKeys.filter((k) => k.status === 'cooling_down');
  const rotationMode = getGeminiRotationMode(profile);
  const rrIndex = aiGatewayClient.getRoundRobinIndex();
  const nextRoundRobinKey =
    activeKeys.length > 0 ? activeKeys[rrIndex % activeKeys.length] : null;

  const handleAddKey = () => {
    const clean = keyInput.trim();
    if (!clean || saving) return;
    systemSound.playClick();
    setSaving(true);
    try {
      const label = labelInput.trim() || `Core #${currentKeys.length + 1}`;
      const updated = addUserGeminiApiKey(clean, label);
      setKeyInput('');
      setLabelInput('');
      toast.success('AI CORE BOUND TO ROTATION POOL', {
        description: `Key registered as "${label}". Added to Dynamic Round Robin rotation.`,
      });
      onSaved?.(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKey = (id: string, label?: string) => {
    systemSound.playClick();
    const updated = removeUserGeminiApiKey(id);
    toast.success('CORE DISCONNECTED', {
      description: `Removed "${label || 'Core'}" from rotation pool.`,
    });
    onSaved?.(updated);
  };

  const handleToggleActive = (id: string, currentVal?: boolean) => {
    systemSound.playClick();
    const updated = updateUserGeminiApiKey(id, { isActive: currentVal === false });
    onSaved?.(updated);
  };

  const handleResetCooldown = (id: string) => {
    systemSound.playClick();
    const updated = resetGeminiKeyCooldown(id);
    toast.success('CORE COOLDOWN RESET', {
      description: 'Key returned to active status in rotation pool.',
    });
    onSaved?.(updated);
  };

  const handleMoveKey = (index: number, direction: 'up' | 'down') => {
    systemSound.playClick();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentKeys.length) return;

    const newKeys = [...currentKeys];
    const [moved] = newKeys.splice(index, 1);
    newKeys.splice(targetIndex, 0, moved);

    const updated = reorderUserGeminiApiKeys(newKeys);
    onSaved?.(updated);
  };

  const handleSetStrategyMode = (mode: 'round_robin' | 'sequential') => {
    systemSound.playClick();
    const updated = setGeminiRotationMode(mode);
    toast.success(`ROTATION STRATEGY: ${mode === 'round_robin' ? 'DYNAMIC ROUND ROBIN' : 'SEQUENTIAL FAILOVER'}`, {
      description:
        mode === 'round_robin'
          ? 'Requests will now rotate evenly across all healthy keys (Key 1 → Key 2 → Key 3).'
          : 'Requests will stick to Key 1 until exhausted, then cascade to backups.',
    });
    onSaved?.(updated);
  };

  const handleClearAll = () => {
    if (currentKeys.length === 0) return;
    systemSound.playClick();
    if (window.confirm('Disconnect all personal AI keys and revert to the shared System key?')) {
      const updated = clearAllUserGeminiApiKeys();
      toast.success('ROTATION POOL CLEARED', {
        description: 'Reverted to shared System AI key.',
      });
      onSaved?.(updated);
    }
  };

  const handleTestCycle = async () => {
    if (testing) return;
    systemSound.playClick();
    setTesting(true);
    setTestResult(null);
    try {
      const start = Date.now();
      const res = await aiGatewayClient.complete('System verification check. Respond with "AI Core verified".', {
        maxTokens: 30,
        skipCache: true,
        providerOverride: 'gemini',
      });
      const ms = Date.now() - start;
      const meta = aiGatewayClient.lastGatewayInfo;
      const keyInfo = meta?.keyMasked ? ` [Core ${meta.keyMasked}]` : meta?.keySource === 'user' ? ' [Personal Core]' : ' [Shared Key]';
      const rotatedNote = meta?.rotatedCount && meta.rotatedCount > 0 ? ` (auto-rotated ${meta.rotatedCount}x)` : '';
      setTestResult(`✓ Active: "${res.trim()}" in ${ms}ms${keyInfo}${rotatedNote}`);
      toast.success('ROTATION CYCLE VERIFIED', {
        description: `Served by ${meta?.keyMasked || (meta?.keySource === 'user' ? 'personal core' : 'shared system')}. Cursor advanced to next core.`,
      });
      // Force trigger state update to reflect updated cursor
      setTimerTick((t) => t + 1);
    } catch (err: any) {
      setTestResult(`✗ Failed: ${err?.message || 'Connection error'}`);
      toast.error('VERIFICATION FAILED', {
        description: err?.message || 'Could not connect to Gemini.',
      });
    } finally {
      setTesting(false);
    }
  };

  const formatRemainingCooldown = (until?: number): string => {
    if (!until) return '';
    const diff = until - Date.now();
    if (diff <= 0) return 'Recovering now...';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s left`;
  };

  return createPortal(
    <div className="modal-safe-pad fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center animate-fade-in font-mono">
      <div className="relative max-w-[660px] w-full bg-[#0a1b2e]/95 border-2 border-cyan-400/60 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_40px_rgba(0,0,0,0.95),inset_0_0_30px_rgba(0,212,255,0.08)] font-mono anime-dropdown modal-card-max-h flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 border border-cyan-400/70 bg-[#061426]/80 shadow-[0_0_14px_rgba(0,212,255,0.35)] flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-cyan-300 animate-spin-slow" />
              <span className="font-mono font-extrabold tracking-[0.22em] text-xs sm:text-sm text-white anime-glow-text uppercase">
                AI CORE KEYS & DYNAMIC ROTATION
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-cyan-300 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 text-xs custom-scrollbar">
          {/* Strategy Selection Toggle */}
          <div className="border border-cyan-500/30 bg-[#061424]/90 rounded-[2px] p-2.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">
                STRATEGY MODE:
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSetStrategyMode('round_robin')}
                className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-[2px] border transition-all cursor-pointer ${
                  rotationMode === 'round_robin'
                    ? 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-[0_0_10px_rgba(0,212,255,0.4)]'
                    : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                }`}
              >
                ● DYNAMIC ROUND ROBIN
              </button>
              <button
                type="button"
                onClick={() => handleSetStrategyMode('sequential')}
                className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-[2px] border transition-all cursor-pointer ${
                  rotationMode === 'sequential'
                    ? 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-[0_0_10px_rgba(0,212,255,0.4)]'
                    : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                }`}
              >
                SEQUENTIAL FAILOVER
              </button>
            </div>
          </div>

          {/* Status HUD Banner */}
          <div className="border border-white/30 bg-[#061424]/90 rounded-[2px] p-3 shadow-inner">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[2px] border border-cyan-500/40 bg-black/60 flex items-center justify-center shrink-0">
                  <ShieldCheck
                    className={`w-4 h-4 ${
                      activeKeys.length > 0 ? 'text-emerald-400' : currentKeys.length > 0 ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                    <span>
                      {currentKeys.length === 0
                        ? 'SHARED SYSTEM AI CORE'
                        : `${currentKeys.length} ${currentKeys.length === 1 ? 'CORE' : 'CORES'} BOUND TO POOL`}
                    </span>
                    {activeKeys.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.2 border border-emerald-500/50 bg-emerald-950/50 text-emerald-300 font-bold rounded-[2px]">
                        {activeKeys.length} READY
                      </span>
                    )}
                    {coolingKeys.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.2 border border-amber-500/50 bg-amber-950/50 text-amber-300 font-bold rounded-[2px]">
                        {coolingKeys.length} COOLING DOWN
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/50 truncate">
                    {currentKeys.length === 0
                      ? 'No personal keys bound. Operating on shared limits with all Hunters.'
                      : rotationMode === 'round_robin' && nextRoundRobinKey
                      ? `Round Robin Turn: "${nextRoundRobinKey.label || 'Core'}" (••••${nextRoundRobinKey.key.slice(-4)})`
                      : activeKeys[0]
                      ? `Active Core: "${activeKeys[0].label || 'Core'}" (••••${activeKeys[0].key.slice(-4)})`
                      : 'All bound cores cooling down. Automatic shared backup active.'}
                  </div>
                </div>
              </div>

              {/* Action buttons on banner */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTestCycle}
                  disabled={testing}
                  className="flex items-center gap-1 px-2 py-1 border border-cyan-400/50 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 rounded-[2px] text-[10px] font-bold tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                  title="Ping Gemini and advance round robin cycle"
                >
                  <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'TESTING...' : 'TEST CYCLE'}</span>
                </button>

                {currentKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="flex items-center gap-1 px-2 py-1 border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 rounded-[2px] text-[10px] font-bold tracking-wider transition-all cursor-pointer"
                    title="Disconnect all personal keys"
                  >
                    <Trash2 className="w-3 h-3" /> CLEAR ALL
                  </button>
                )}
              </div>
            </div>

            {testResult && (
              <div
                className={`mt-2 p-1.5 border rounded-[2px] text-[10px] font-mono ${
                  testResult.startsWith('✓')
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                    : 'border-rose-500/50 bg-rose-950/40 text-rose-300'
                }`}
              >
                {testResult}
              </div>
            )}
          </div>

          {/* Bound Keys Pool List */}
          {currentKeys.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-cyan-300/80 font-bold tracking-widest px-1">
                <span>
                  {rotationMode === 'round_robin'
                    ? 'DYNAMIC ROUND ROBIN CYCLE (KEY 1 → KEY 2 → KEY 3...)'
                    : 'SEQUENTIAL ROTATION STACK (PRIORITY ORDER)'}
                </span>
                <span className="text-white/40">{currentKeys.length} REGISTERED</span>
              </div>

              <div className="space-y-1.5">
                {currentKeys.map((k, index) => {
                  const isCooling = k.status === 'cooling_down';
                  const isInvalid = k.status === 'invalid';
                  const isPaused = k.isActive === false;
                  const isNextInRoundRobin =
                    rotationMode === 'round_robin' && nextRoundRobinKey?.id === k.id;
                  const isPrimarySequential =
                    rotationMode === 'sequential' && index === 0;

                  return (
                    <div
                      key={k.id}
                      className={`border rounded-[2px] p-2.5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                        isPaused
                          ? 'border-white/10 bg-black/40 opacity-60'
                          : isInvalid
                          ? 'border-rose-500/50 bg-rose-950/20 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                          : isCooling
                          ? 'border-amber-500/50 bg-amber-950/20 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                          : isNextInRoundRobin || isPrimarySequential
                          ? 'border-cyan-400/80 bg-[#09223d]/90 shadow-[0_0_14px_rgba(0,212,255,0.2)]'
                          : 'border-white/25 bg-[#061424]/80'
                      }`}
                    >
                      {/* Left side info */}
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {/* Priority / Slot number */}
                        <div
                          className={`w-6 h-6 rounded-[2px] border text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            isNextInRoundRobin || isPrimarySequential
                              ? 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                              : 'border-white/20 bg-black/40 text-white/60'
                          }`}
                        >
                          #{index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white tracking-wide">
                              {k.label || `Core #${index + 1}`}
                            </span>

                            {/* Status badge */}
                            {isPaused ? (
                              <span className="text-[9px] px-1.5 py-0.2 border border-white/20 bg-black/60 text-white/50 rounded-[2px] font-bold">
                                PAUSED
                              </span>
                            ) : isInvalid ? (
                              <span className="text-[9px] px-1.5 py-0.2 border border-rose-500/60 bg-rose-950/60 text-rose-300 rounded-[2px] font-bold flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> INVALID KEY
                              </span>
                            ) : isCooling ? (
                              <span className="text-[9px] px-1.5 py-0.2 border border-amber-500/60 bg-amber-950/60 text-amber-300 rounded-[2px] font-bold flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 animate-pulse" />
                                {formatRemainingCooldown(k.cooldownUntil)}
                              </span>
                            ) : isNextInRoundRobin ? (
                              <span className="text-[9px] px-1.5 py-0.2 border border-cyan-400 bg-cyan-950/80 text-cyan-300 rounded-[2px] font-bold flex items-center gap-1 shadow-[0_0_6px_rgba(0,212,255,0.4)]">
                                <Sparkles className="w-2.5 h-2.5 animate-pulse" /> NEXT IN CYCLE
                              </span>
                            ) : isPrimarySequential ? (
                              <span className="text-[9px] px-1.5 py-0.2 border border-cyan-400 bg-cyan-950/80 text-cyan-300 rounded-[2px] font-bold flex items-center gap-1 shadow-[0_0_6px_rgba(0,212,255,0.4)]">
                                <Sparkles className="w-2.5 h-2.5" /> PRIMARY CORE
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 border border-emerald-500/50 bg-emerald-950/50 text-emerald-300 rounded-[2px] font-bold">
                                IN ROTATION POOL
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1 flex-wrap">
                            <span className="font-mono text-cyan-200/70">
                              ••••••••{k.key.slice(-4)}
                            </span>
                            {k.usageCount !== undefined && k.usageCount > 0 && (
                              <span>• {k.usageCount} {k.usageCount === 1 ? 'request' : 'requests'} served</span>
                            )}
                            {k.failureReason && (
                              <span className="text-amber-300/80">• {k.failureReason}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side controls */}
                      <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                        {isCooling && (
                          <button
                            type="button"
                            onClick={() => handleResetCooldown(k.id)}
                            className="px-2 py-1 border border-amber-500/50 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 rounded-[2px] text-[10px] font-bold tracking-wider transition-all cursor-pointer"
                            title="Reset cooldown now"
                          >
                            RESET
                          </button>
                        )}

                        {/* Reorder Buttons */}
                        <div className="flex items-center border border-white/20 rounded-[2px] overflow-hidden bg-black/40">
                          <button
                            type="button"
                            onClick={() => handleMoveKey(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-white/60 hover:text-white disabled:opacity-20 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            title="Move Up (Order in Cycle)"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <div className="w-[1px] h-3 bg-white/20" />
                          <button
                            type="button"
                            onClick={() => handleMoveKey(index, 'down')}
                            disabled={index === currentKeys.length - 1}
                            className="p-1 text-white/60 hover:text-white disabled:opacity-20 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            title="Move Down (Order in Cycle)"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Pause / Resume Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(k.id, k.isActive)}
                          className={`px-1.5 py-1 border rounded-[2px] text-[10px] font-bold transition-all cursor-pointer ${
                            k.isActive !== false
                              ? 'border-white/20 bg-black/40 text-white/70 hover:text-white'
                              : 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                          }`}
                          title={k.isActive !== false ? 'Pause this key from cycle' : 'Re-include this key in cycle'}
                        >
                          {k.isActive !== false ? 'PAUSE' : 'ENABLE'}
                        </button>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveKey(k.id, k.label)}
                          className="p-1 border border-rose-500/30 hover:border-rose-400 bg-rose-950/20 hover:bg-rose-900/40 text-rose-300 rounded-[2px] transition-colors cursor-pointer"
                          title="Remove key from pool"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-white/20 rounded-[2px] p-4 text-center text-white/50 text-[11px]">
              No personal Gemini keys registered. The System will route AI generations through shared server capacity.
            </div>
          )}

          {/* Add Key to Pool Card */}
          <div className="border border-cyan-500/40 bg-[#07172b]/85 rounded-[2px] p-3 shadow-inner">
            <div className="text-[10px] font-bold text-cyan-300 tracking-wider flex items-center gap-1.5 mb-2 uppercase">
              <Plus className="w-3.5 h-3.5" />
              <span>ADD GEMINI CORE TO ROTATION POOL</span>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <label className="text-[9px] text-white/50 uppercase block mb-1">
                    Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder={`e.g. Account #${currentKeys.length + 1}`}
                    className="w-full bg-black/60 border border-white/25 rounded-[2px] px-2.5 py-1.5 font-mono text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[9px] text-white/50 uppercase block mb-1">
                    API Key (Starts with "AIza...")
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type={reveal ? 'text' : 'password'}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="flex-1 min-w-0 bg-black/60 border border-white/25 rounded-[2px] px-2.5 py-1.5 font-mono text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((r) => !r)}
                      className="w-8 h-8 shrink-0 border border-white/30 bg-black/40 hover:bg-white/10 text-white/70 rounded-[2px] flex items-center justify-center cursor-pointer"
                      title={reveal ? 'Hide' : 'Show'}
                    >
                      {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddKey}
                  disabled={!keyInput.trim() || saving}
                  className="px-3 py-1.5 border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,212,255,0.35)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{saving ? 'BINDING...' : 'BIND CORE TO POOL'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Strategy Details Explanation Box */}
          <div className="border border-white/15 bg-black/40 rounded-[2px] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowStrategyDetails((s) => !s)}
              className="w-full p-2.5 flex items-center justify-between text-left text-cyan-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-bold tracking-widest uppercase">
                  HOW DYNAMIC ROUND ROBIN PROTECTS YOUR QUOTAS
                </span>
              </div>
              <span className="text-[10px] text-white/50">
                {showStrategyDetails ? '[ HIDE ]' : '[ VIEW LOGIC ]'}
              </span>
            </button>

            {showStrategyDetails && (
              <div className="p-3 border-t border-white/10 text-[10px] text-white/70 space-y-2 leading-relaxed bg-[#05111f]/60">
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">Load-Balanced Rotation:</strong> With Dynamic Round Robin, incoming AI tasks cycle sequentially through your keys (Call 1 $\rightarrow$ Core A, Call 2 $\rightarrow$ Core B, Call 3 $\rightarrow$ Core C).
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">Multiplied Rate-Limit Headroom:</strong> Instead of hammering one key until it hits Gemini's 15 requests/min ceiling, load is balanced across all cores so each key stays well below its rate limit.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">Dynamic Cooldown Bypass:</strong> If any key hits a limit (HTTP 429), it enters cooldown and is immediately bypassed in the cycle. The other healthy keys continue taking turns smoothly.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">Automated Recovery:</strong> Once a key's cooldown timer finishes, it automatically rejoins the round-robin cycle without any manual reset needed.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">Shared System Safety Net:</strong> If every single personal key in your pool happens to be in cooldown simultaneously, THEIA automatically cascades to the shared system tier.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guide / How to Get Free Keys */}
          <div className="border border-white/15 bg-black/40 rounded-[2px] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide((g) => !g)}
              className="w-full p-2.5 flex items-center justify-between text-left text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-[#9fd3ff]" />
                <span className="text-[10px] font-bold tracking-widest uppercase">
                  HOW TO GET FREE GEMINI API KEYS
                </span>
              </div>
              <span className="text-[10px] text-white/50">
                {showGuide ? '[ HIDE ]' : '[ VIEW STEPS ]'}
              </span>
            </button>

            {showGuide && (
              <div className="p-3 border-t border-white/10 text-[10px] space-y-2 bg-[#05111f]/60">
                <ol className="space-y-1.5">
                  {GEMINI_STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 shrink-0 rounded-[2px] border border-cyan-400/60 bg-cyan-950/60 text-cyan-300 text-[9px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-[11px] text-white/90 font-semibold">{step.label}</div>
                        <div className="text-[10px] text-white/50">{step.detail}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="pt-1.5">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-cyan-400/60 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 hover:text-white rounded-[2px] text-[10px] font-bold tracking-wider transition-all"
                  >
                    <ExternalLink className="w-3 h-3" /> OPEN GOOGLE AI STUDIO
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="text-[10px] text-white/40 hidden sm:block">
            Keys are stored locally in player dossier storage. Never shared.
          </div>
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="py-1.5 px-4 border border-cyan-400 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)] ml-auto cursor-pointer"
          >
            [ CLOSE ]
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
