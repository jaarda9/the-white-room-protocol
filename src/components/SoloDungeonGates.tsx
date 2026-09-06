import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import {
  Dumbbell, Brain, Users, BookOpen, Crown, Target, TestTube,
  Lock, ArrowRight, ShieldAlert, Sparkles
} from 'lucide-react';

interface Props {
  profile: UserProfile;
}

export const SoloDungeonGates = ({ profile }: Props) => {
  const navigate = useNavigate();

  const gates = [
    {
      id: 'physical',
      title: 'PHYSICAL CONDITIONING',
      subtitle: 'Body conditioning, hypertrophy & stamina',
      path: '/physical-lab',
      icon: Dumbbell,
      rank: 'E-RANK GATE',
      minLvl: 1,
      auraColor: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400',
      glow: 'shadow-[0_0_15px_rgba(0,240,255,0.15)]',
    },
    {
      id: 'mental',
      title: 'COGNITIVE TRIAL CHAMBER',
      subtitle: 'Working memory, speed processing & focus',
      path: '/mental-lab',
      icon: Brain,
      rank: 'D-RANK GATE',
      minLvl: 1,
      auraColor: 'border-blue-500/40 bg-blue-950/20 text-blue-400',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
    },
    {
      id: 'social',
      title: 'SOCIAL SIMULATION PORTAL',
      subtitle: 'Interpersonal debriefs, negotiation & cues',
      path: '/social-lab',
      icon: Users,
      rank: 'D-RANK GATE',
      minLvl: 1,
      auraColor: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    },
    {
      id: 'kinnu',
      title: 'KINNU SKILL MAPS',
      subtitle: 'Micro-learning nodes, quizzes & skill trees',
      path: '/kinnu-lab',
      icon: TestTube,
      rank: 'D-RANK GATE',
      minLvl: 1,
      auraColor: 'border-teal-500/40 bg-teal-950/20 text-teal-400',
      glow: 'shadow-[0_0_15px_rgba(20,184,166,0.15)]',
    },
    {
      id: 'knowledge',
      title: 'KNOWLEDGE VAULT',
      subtitle: 'Domain quizzes, research & intelligence',
      path: '/knowledge-lab',
      icon: BookOpen,
      rank: 'C-RANK GATE',
      minLvl: 1,
      auraColor: 'border-purple-500/40 bg-purple-950/20 text-purple-400',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    },
    {
      id: 'chess',
      title: 'STRATEGIC CHESS TRIAL',
      subtitle: 'Tactical analysis, depth calculation & foresight',
      path: '/chess-lab',
      icon: Crown,
      rank: 'C-RANK GATE',
      minLvl: 1,
      auraColor: 'border-amber-500/40 bg-amber-950/20 text-amber-400',
      glow: 'shadow-[0_0_15px_rgba(251,191,36,0.15)]',
    },
    {
      id: 'skillforge',
      title: 'SKILL BLUEPRINT FORGE',
      subtitle: 'AI-generated personalized learning curricula',
      path: '/skill-forge',
      icon: Target,
      rank: 'B-RANK GATE',
      minLvl: 1,
      auraColor: 'border-pink-500/40 bg-pink-950/20 text-pink-400',
      glow: 'shadow-[0_0_15px_rgba(244,114,182,0.15)]',
    },
  ];

  const handleEnterGate = (path: string, locked: boolean) => {
    if (locked) {
      systemSound.playPenaltyWarning();
      return;
    }
    systemSound.playClick();
    navigate(path);
  };

  return (
    <div className="system-window tech-corners p-5 sm:p-6 w-full relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-primary/40 pb-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-purple-500 animate-ping" />
          <h2 className="text-xl sm:text-2xl font-display font-black tracking-widest text-white shadow-glow-text">
            [ INSTANCE DUNGEONS & GATES ]
          </h2>
        </div>
        <span className="text-xs font-mono text-primary/80 border border-primary/40 px-2 py-0.5 bg-primary/10">
          SELECT TRAINING GATE
        </span>
      </div>

      {/* Gates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gates.map((gate) => {
          const Icon = gate.icon;
          const isLocked = profile.level < gate.minLvl;

          return (
            <div
              key={gate.id}
              onClick={() => handleEnterGate(gate.path, isLocked)}
              className={`p-4 border transition-all relative group cursor-pointer ${isLocked ? 'border-gray-800 bg-black/60 opacity-60 hover:border-red-500/40' : `${gate.auraColor} hover:border-primary hover:scale-[1.02] ${gate.glow}`}`}
            >
              {/* Corner Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-mono px-2 py-0.5 border font-bold ${isLocked ? 'border-gray-700 text-gray-400 bg-black' : 'border-current'}`}>
                  {gate.rank}
                </span>

                {isLocked ? (
                  <span className="text-[10px] font-mono text-red-400 flex items-center gap-1 border border-red-500/40 px-1.5 py-0.2 bg-red-950/40">
                    <Lock className="w-3 h-3" />
                    REQ: LV.{gate.minLvl}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    GATE OPEN
                  </span>
                )}
              </div>

              {/* Title & Icon */}
              <div className="flex items-start gap-3 mb-2">
                <div className={`p-2.5 border ${isLocked ? 'border-gray-700 bg-gray-900 text-gray-500' : 'border-current bg-black/40'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-white tracking-wider group-hover:text-primary transition-colors">
                    {gate.title}
                  </h4>
                  <p className="text-xs font-tech text-gray-400 mt-0.5 line-clamp-2">
                    {gate.subtitle}
                  </p>
                </div>
              </div>

              {/* Enter Button Indicator */}
              <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="text-[11px] text-muted-foreground">
                  {isLocked ? `Unlocks at Hunter Level ${gate.minLvl}` : 'Ready for Infiltration'}
                </span>
                <span className={`flex items-center gap-1 font-bold ${isLocked ? 'text-gray-600' : 'text-primary group-hover:translate-x-1 transition-transform'}`}>
                  ENTER <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
