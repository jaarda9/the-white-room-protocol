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
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>
        </div>

        <div className="anime-window p-6 text-center">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
            ARCHIVE OF HUMAN KNOWLEDGE
          </h1>
          <p className="text-xs font-mono text-gray-400 mt-1">
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
                className="anime-window p-6 cursor-pointer hover:border-cyan-400 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Icon className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono border border-cyan-500/30 px-2 py-0.5 text-cyan-300">
                      INTEL SECTOR
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-display font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {domain.name}
                    </h3>
                    <p className="text-xs font-mono text-gray-400 mt-1">
                      {domain.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-cyan-500/20 flex items-center justify-between font-mono text-xs text-cyan-300">
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
