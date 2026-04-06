import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapNode } from '@/data/courseData';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, BookOpen, Brain } from 'lucide-react';

interface LessonViewerProps {
  node: MapNode;
  onStartQuiz: () => void;
  onBack: () => void;
}

export default function LessonViewer({ node, onStartQuiz, onBack }: LessonViewerProps) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const sections = node.lesson.sections;
  const isLast = sectionIndex === sections.length;
  const showingSummary = sectionIndex === sections.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Map
      </button>

      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold">{node.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{node.lesson.objective}</p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 mb-8">
        {[...sections, null].map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= sectionIndex ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!showingSummary ? (
          <motion.div
            key={sectionIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="bg-card border border-border rounded-xl p-8"
          >
            <h3 className="text-lg font-semibold mb-4 text-primary">{sections[sectionIndex].title}</h3>
            <p className="text-foreground/90 leading-relaxed text-[15px]">{sections[sectionIndex].body}</p>
          </motion.div>
        ) : (
          <motion.div
            key="summary"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="bg-card border border-border rounded-xl p-8"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-accent" />
              Key Takeaways
            </h3>
            <ul className="space-y-3">
              {node.lesson.keyTakeaways.map((t, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 text-foreground/90"
                >
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                  {t}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => setSectionIndex(Math.max(0, sectionIndex - 1))}
          disabled={sectionIndex === 0}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </Button>

        {showingSummary ? (
          <Button onClick={onStartQuiz} className="gap-2 glow-primary">
            <Brain className="w-4 h-4" /> Start Quiz
          </Button>
        ) : (
          <Button onClick={() => setSectionIndex(sectionIndex + 1)} className="gap-2">
            {sectionIndex === sections.length - 1 ? 'Summary' : 'Next'} <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
