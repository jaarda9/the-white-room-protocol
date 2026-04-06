import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgress } from '@/hooks/useProgress';
import { COURSE_NODES } from '@/data/courseData';
import LearningMap from '@/components/LearningMap';
import LessonViewer from '@/components/LessonViewer';
import QuizView from '@/components/QuizView';
import ProfileDashboard from '@/components/ProfileDashboard';
import { Zap, Flame, User, Map } from 'lucide-react';

type View = 'map' | 'lesson' | 'quiz' | 'profile';

const Index = () => {
  const { progress, getNodeStatus, completeNode, resetProgress } = useProgress();
  const [view, setView] = useState<View>('map');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const activeNode = activeNodeId ? COURSE_NODES.find(n => n.id === activeNodeId) : null;

  const handleSelectNode = useCallback((id: string) => {
    const status = getNodeStatus(id);
    if (status === 'locked') return;
    setActiveNodeId(id);
    if (status === 'completed') {
      setView('lesson'); // allow re-reading
    } else {
      setView('lesson');
    }
  }, [getNodeStatus]);

  const handleQuizComplete = useCallback((score: number) => {
    if (activeNodeId && score >= 50) {
      completeNode(activeNodeId, score);
    }
    setView('map');
    setActiveNodeId(null);
  }, [activeNodeId, completeNode]);

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Map className="w-4 h-4 text-primary" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">
              <span className="text-primary">Learn</span>Quest
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Zap className="w-4 h-4 text-accent" />
              <span className="font-mono font-bold">{progress.xp}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Flame className="w-4 h-4 text-destructive" />
              <span className="font-mono font-bold">{progress.streak}</span>
            </div>
            <button
              onClick={() => setView(view === 'profile' ? 'map' : 'profile')}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'map' && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">
                  Web Development <span className="text-primary text-glow-primary">Journey</span>
                </h2>
                <p className="text-muted-foreground text-sm">Navigate the skill tree to master web development fundamentals</p>
              </div>
              <LearningMap getNodeStatus={getNodeStatus} onSelectNode={handleSelectNode} />
            </motion.div>
          )}

          {view === 'lesson' && activeNode && (
            <motion.div key="lesson" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LessonViewer
                node={activeNode}
                onStartQuiz={() => setView('quiz')}
                onBack={() => { setView('map'); setActiveNodeId(null); }}
              />
            </motion.div>
          )}

          {view === 'quiz' && activeNode && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <QuizView
                node={activeNode}
                onComplete={handleQuizComplete}
                onBack={() => setView('lesson')}
              />
            </motion.div>
          )}

          {view === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProfileDashboard
                progress={progress}
                onReset={resetProgress}
                onClose={() => setView('map')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
