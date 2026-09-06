import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Landmark, Globe, TrendingUp, Scale, ChevronRight } from 'lucide-react';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { systemSound } from '@/lib/system-sound';

export default function KnowledgeLab() {
  const navigate = useNavigate();

  const domains = [
    {
      id: 'science',
      name: 'Science & Physics',
      icon: FlaskConical,
      description: 'Quantum Mechanics, Organic Chemistry, Astrodynamics & Computation',
    },
    {
      id: 'history',
      name: 'World History & War',
      icon: Landmark,
      description: 'Ancient Empires, Strategic Conflicts & Civilizational Evolution',
    },
    {
      id: 'geography',
      name: 'Global Geography',
      icon: Globe,
      description: 'Geopolitical Borders, Topography & Planetary Systems',
    },
    {
      id: 'economics',
      name: 'Macroeconomics',
      icon: TrendingUp,
      description: 'Capital Allocation, Market Dynamics & Financial Architectures',
    },
    {
      id: 'politics',
      name: 'Political Theory',
      icon: Scale,
      description: 'Governance Frameworks, Diplomacy & Power Structures',
    },
  ];

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
              ARCHIVE OF HUMAN KNOWLEDGE
            </h1>
          </div>
          <p className="text-xs font-mono text-white/80 mt-1">
            System intellectual trials. Complete domain archives to enhance INT and WIS attributes.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {domains.map((domain) => {
            const Icon = domain.icon;
            return (
              <div
                key={domain.id}
                onClick={() => {
                  systemSound.playClick();
                  navigate(`/knowledge/${domain.id}`);
                }}
                className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-6 cursor-pointer hover:border-white/90 hover:bg-[#0a1b2e] transition-all flex flex-col justify-between group shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Icon className="w-6 h-6 text-[#9fd3ff] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono border border-white/40 px-2 py-0.5 text-white bg-black/40">
                      INTEL SECTOR
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-mono font-bold text-white group-hover:text-[#9fd3ff] transition-colors">
                      {domain.name}
                    </h3>
                    <p className="text-xs font-mono text-gray-300 mt-1">
                      {domain.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between font-mono text-xs text-[#9fd3ff]">
                  <span>ENTER ARCHIVE</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
