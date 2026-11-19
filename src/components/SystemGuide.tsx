import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { GUIDE_UPDATED_EVENT, finishTour, getGuideState, skipGuide } from '@/lib/system-guide';
import { systemSound } from '@/lib/system-sound';

interface GuideStep {
  /** Dashboard view shown behind the card while this step is open. */
  view: 'status' | 'quests' | 'dungeons' | 'notifications' | 'records';
  title: string;
  body: React.ReactNode;
}

const STEPS: GuideStep[] = [
  {
    view: 'status',
    title: '[THE SYSTEM HAS CHOSEN YOU]',
    body: (
      <>
        This System gives you real training every day and holds you to it. Your level, rank (E to S) and stats grow
        as you complete it. Want the 1-minute tour?
      </>
    ),
  },
  {
    view: 'quests',
    title: 'DAILY QUEST',
    body: (
      <>
        New directives arrive every day at midnight. Clear the mandatory ones, then press the check to claim EXP and
        unlock <b>BONUS</b> directives. Leaving one unfinished means a <b>Penalty Quest</b>. Travelling or sick? Declare
        an absence in your Profile first.
      </>
    ),
  },
  {
    view: 'dungeons',
    title: 'GATES',
    body: (
      <>
        Bigger goals that take weeks, like learning a skill. Say what you want to achieve and THEIA designs the plan.
        One task opens each day; THEIA checks it from a short report.
      </>
    ),
  },
  {
    view: 'status',
    title: 'THE BAR BELOW',
    body: (
      <>
        <b>COMMS</b>: messages and your Party. <b>SYSTEM</b>: notices, Seals, Skill Tree, Records and your Profile. Turn
        on the <b>System Uplink</b> in your Profile to get reminders even when the app is closed.
      </>
    ),
  },
];

/**
 * The orientation tour for new Hunters. Sits above the dock while the real dashboard view for
 * each step shows behind it, so the player sees what is being described.
 */
export default function SystemGuide() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(() => getGuideState().tourPending);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const sync = () => setPending(getGuideState().tourPending);
    window.addEventListener(GUIDE_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(GUIDE_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const active = Boolean(user) && pending && location.pathname === '/';
  const current = STEPS[step];

  // Show the matching dashboard view behind the card.
  useEffect(() => {
    if (!active) return;
    const view = new URLSearchParams(location.search).get('view') || 'status';
    if (view !== current.view) {
      navigate(current.view === 'status' ? '/' : `/?view=${current.view}`, { replace: true });
    }
  }, [active, current.view, location.search, navigate]);

  if (!active) return null;

  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none font-mono">
      <div className="absolute inset-0 bg-black/45" />
      <div
        className="absolute left-0 right-0 flex justify-center px-3 pointer-events-auto"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
      >
        <div
          key={step}
          className="w-full max-w-md bg-[#0a1b2e] border-2 border-[#00d4ff]/70 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_30px_rgba(0,212,255,0.35),inset_0_0_20px_rgba(0,212,255,0.08)] anime-dropdown"
          role="dialog"
          aria-label="System guide"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#00d4ff] tracking-[0.15em] anime-glow-text">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{current.title}</span>
            </div>
            <span className="text-[10px] text-white/40 shrink-0">
              {step + 1}/{STEPS.length}
            </span>
          </div>
          <p className="text-xs text-gray-200 leading-relaxed">{current.body}</p>

          <div className="flex items-center gap-1 mt-3" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#00d4ff]' : 'bg-white/15'}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                systemSound.playClick();
                skipGuide();
              }}
              className="text-[11px] text-white/45 hover:text-white transition-colors"
            >
              {step === 0 ? 'Skip, I’ll explore' : 'Skip guide'}
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setStep((s) => s - 1);
                  }}
                  className="p-1.5 border border-white/30 text-white/70 hover:text-white hover:border-white rounded-[2px] transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (last) {
                    systemSound.playLevelUp();
                    finishTour();
                    navigate('/?view=quests', { replace: true });
                  } else {
                    systemSound.playClick();
                    setStep((s) => s + 1);
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-black text-[11px] font-bold hover:bg-gray-200 rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)]"
              >
                {last ? 'BEGIN TODAY’S QUEST' : step === 0 ? 'SHOW ME AROUND' : 'NEXT'}
                {!last && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
