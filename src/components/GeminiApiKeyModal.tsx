import { useState } from 'react';
import { UserProfile } from '@/lib/types';
import { saveUserGeminiApiKey } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import { X, KeyRound, ExternalLink, Trash2, Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaved?: (updatedProfile: UserProfile) => void;
}

const GEMINI_STEPS = [
  { label: 'Open Google AI Studio', detail: 'aistudio.google.com/apikey — link below' },
  { label: 'Sign in with your Google account', detail: 'Any personal Google account works' },
  { label: 'Click "Create API key"', detail: 'Free tier — no card required' },
  { label: 'Copy the key and paste it below', detail: 'Starts with "AIza..."' },
];

export default function GeminiApiKeyModal({ isOpen, onClose, profile, onSaved }: Props) {
  const [keyInput, setKeyInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const hasKey = Boolean(profile.geminiApiKey);
  const maskedKey = hasKey ? `••••••••${profile.geminiApiKey!.slice(-4)}` : null;

  const handleSave = () => {
    if (!keyInput.trim() || saving) return;
    systemSound.playClick();
    setSaving(true);
    try {
      const updated = saveUserGeminiApiKey(keyInput.trim());
      setKeyInput('');
      toast.success('AI ACCESS KEY BOUND', {
        description: 'Your own Gemini quota will now be used for your AI-generated content.',
      });
      onSaved?.(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    systemSound.playClick();
    const updated = saveUserGeminiApiKey(null);
    toast.success('AI ACCESS KEY REMOVED', {
      description: 'Reverted to the shared System key.',
    });
    onSaved?.(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in font-mono overflow-y-auto">
      <div className="relative max-w-[560px] w-full bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] font-mono anime-dropdown max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-[#9fd3ff]" />
              <span className="font-mono font-extrabold tracking-[0.24em] text-sm sm:text-base text-white anime-glow-text">
                AI ACCESS KEY
              </span>
            </div>
            <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">
              [GEMINI SYNC]
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

        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 text-xs">
          {/* Current status */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0">
                <KeyRound className={`w-4 h-4 ${hasKey ? 'text-emerald-400' : 'text-cyan-400'}`} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white tracking-wide">
                  {hasKey ? 'PERSONAL KEY BOUND' : 'USING SHARED SYSTEM KEY'}
                </div>
                <div className="text-[10px] text-white/50 truncate">
                  {hasKey ? maskedKey : 'Subject to shared limits across all Hunters'}
                </div>
              </div>
            </div>
            {hasKey && (
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1 px-2 py-1 border border-rose-500/50 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 rounded-[2px] text-[10px] font-bold tracking-wider transition-all shrink-0"
              >
                <Trash2 className="w-3 h-3" /> REMOVE
              </button>
            )}
          </div>

          {/* Guidance steps */}
          <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-3">
            <div className="text-[10px] tracking-[0.2em] text-cyan-300/80 mb-2">
              SYSTEM DIRECTIVE • HOW TO OBTAIN YOUR OWN KEY (FREE)
            </div>
            <ol className="space-y-1.5">
              {GEMINI_STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 shrink-0 mt-0.5 rounded-[2px] border border-cyan-400/60 bg-cyan-950/60 text-cyan-300 text-[9px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-[11px] text-white/90 font-semibold">{step.label}</div>
                    <div className="text-[10px] text-white/50">{step.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-cyan-400/60 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 hover:text-white rounded-[2px] text-[10px] font-bold tracking-wider transition-all"
            >
              <ExternalLink className="w-3 h-3" /> OPEN GOOGLE AI STUDIO
            </a>
            <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
              Optional. Leave this empty to keep using the shared System key. Your key is stored on
              your profile and used only for your own AI-generated content.
            </p>
          </div>

          {/* Input */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
              PASTE YOUR GEMINI API KEY
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type={reveal ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIza..."
                className="flex-1 min-w-0 bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 font-mono text-white text-xs focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="w-8 h-8 shrink-0 border border-white/30 bg-black/40 hover:bg-white/10 text-white/70 rounded-[2px] flex items-center justify-center"
                title={reveal ? 'Hide' : 'Show'}
              >
                {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="py-2 px-3 border border-white/30 bg-black/40 text-white/70 hover:text-white rounded-[2px] text-[11px] font-bold transition-colors"
          >
            [ CLOSE ]
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!keyInput.trim() || saving}
            className="flex-1 py-2 px-3 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_14px_rgba(0,212,255,0.4)] disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? '[ BINDING... ]' : '[ BIND KEY ]'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
