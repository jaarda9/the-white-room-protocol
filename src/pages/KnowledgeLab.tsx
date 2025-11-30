import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, BookOpen, FlaskConical, Landmark, Globe, TrendingUp, Scale } from 'lucide-react';

export default function KnowledgeLab() {
  const navigate = useNavigate();

  const domains = [
    {
      id: 'science' as const,
      name: 'Science Research',
      icon: FlaskConical,
      description: 'Physics, Biology, Chemistry, Earth Sciences, Technology',
      color: 'text-blue-500',
    },
    {
      id: 'history' as const,
      name: 'History Research',
      icon: Landmark,
      description: 'Ancient Civilizations, Medieval Period, Modern History',
      color: 'text-amber-500',
    },
    {
      id: 'geography' as const,
      name: 'Geography Research',
      icon: Globe,
      description: 'Physical Geography, Human Geography, Political Geography',
      color: 'text-green-500',
    },
    {
      id: 'economics' as const,
      name: 'Economics Research',
      icon: TrendingUp,
      description: 'Microeconomics, Macroeconomics, International Economics',
      color: 'text-purple-500',
    },
    {
      id: 'politics' as const,
      name: 'Politics Research',
      icon: Scale,
      description: 'Political Systems, Theory, International Relations',
      color: 'text-red-500',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="w-full sm:w-auto justify-start">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <div className="flex-1 w-full">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
                <span className="line-clamp-1">Knowledge Training Lab</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                Daily topics • AI quizzes • Research domains
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        <div className="mb-4 sm:mb-6">
          <p className="text-muted-foreground text-xs sm:text-sm">
            Select a research domain to begin daily topic study and quiz sessions.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain) => {
            const Icon = domain.icon;
            return (
              <Card
                key={domain.id}
                className="p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer group border-border bg-surface hover:border-primary/50"
                onClick={() => navigate(`/knowledge/${domain.id}`)}
              >
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 sm:p-3 rounded-lg bg-primary/10 ${domain.color}`}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 group-hover:text-primary transition-colors">
                      {domain.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                      {domain.description}
                    </p>
                  </div>

                  <Button variant="outline" className="w-full group-hover:border-primary text-sm">
                    Select Domain →
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

