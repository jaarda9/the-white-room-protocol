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
    title: '[THE SYSTEM WILL NOW EXPLAIN ITSELF]',
    body: (
      <>
        You have been chosen, Player. This is not an app you browse: it is a System that assigns you real
        training every day and holds you to it. Seven short briefings. Read them once.
      </>
    ),
  },
  {
    view: 'status',
    title: 'STATUS',
    body: (
      <>
        Your level, rank and stats (STR, AGI, VIT, INT, PER, WIS). Completing directives earns EXP and raises
        the stats tied to them. Every 10 levels your <b>rank</b> rises, from E to S.
      </>
    ),
  },
  {
    view: 'quests',
    title: 'DAILY QUEST',
    body: (
      <>
        Every day at midnight the System assigns your directives. As an E-rank you have <b>4 mandatory</b>{' '}
        ones; more are added as your rank rises. Clear every one, then press the check to claim the reward: EXP,
        +3 AP and full recovery. Claiming it unlocks <b>BONUS</b> directives for extra EXP.
      </>
    ),
  },
  {
    view: 'quests',
    title: 'PENALTY',
    body: (
      <>
        A mandatory directive left unfinished at midnight means a <b>Penalty Quest</b>. Missed days stack, and
        the System escalates. Travelling or sick? Declare an absence in advance in your Hunter Dossier (Profile):
        declared days carry no penalty.
      </>
    ),
  },
  {
    view: 'dungeons',
    title: 'DUNGEONS (GATES)',
    body: (
      <>
        Multi-day challenges you open yourself, like learning a skill step by step. Each day of a Gate unlocks
        at 00:00. Some stages are verified by THEIA, the System&apos;s intelligence, with a quiz or a short
        report.
      </>
    ),
  },
  {
    view: 'notifications',
    title: 'NOTICES & UPLINK',
    body: (
      <>
        Everything the System tells you is logged here. To be reached even when the app is closed, open your
        Profile and grant the <b>System Uplink</b>: quest arrival in the morning, a warning at night, Emergency
        Quests, and messages from other Hunters.
      </>
    ),
  },
  {
    view: 'records',
    title: 'RECORDS & YOUR DOSSIER',
    body: (
      <>
        Rankings, the Codex, achievements, Hunter Comms and your <b>Party</b> live in Records. Your Profile holds calibration
        (training, reading, study), your AI key, notifications and account security. You can replay this guide
        from your Profile at any time.
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
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.25rem)' }}
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
              Skip guide
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
                {last ? 'BEGIN TODAY’S QUEST' : 'NEXT'}
                {!last && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
