import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapNode, QuizQuestion } from '@/data/courseData';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ArrowRight, Trophy } from 'lucide-react';

interface QuizViewProps {
  node: MapNode;
  onComplete: (score: number) => void;
  onBack: () => void;
}

export default function QuizView({ node, onComplete, onBack }: QuizViewProps) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const questions = node.quiz;
  const q = questions[qIndex];
  const isCorrect = selected === q?.correctIndex;
  const score = Math.round((correctCount / questions.length) * 100);

  function handleSelect(idx: number) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.correctIndex) setCorrectCount(c => c + 1);
  }

  function handleNext() {
    if (qIndex + 1 >= questions.length) {
      const finalCorrect = correctCount + (isCorrect ? 0 : 0); // already counted
      setFinished(true);
    } else {
      setQIndex(qIndex + 1);
      setSelected(null);
      setAnswered(false);
    }
  }

  if (finished) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto text-center">
        <div className="bg-card border border-border rounded-2xl p-10">
          <Trophy className={`w-16 h-16 mx-auto mb-4 ${score >= 80 ? 'text-accent' : score >= 50 ? 'text-primary' : 'text-muted-foreground'}`} />
          <h2 className="text-3xl font-bold mb-2">
            {score === 100 ? 'Perfect!' : score >= 80 ? 'Great Job!' : score >= 50 ? 'Not Bad!' : 'Keep Learning!'}
          </h2>
          <p className="text-5xl font-bold text-primary my-4">{score}%</p>
          <p className="text-muted-foreground mb-6">{correctCount} of {questions.length} correct</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onBack}>Back to Map</Button>
            <Button onClick={() => onComplete(score)} className="glow-primary">
              {score >= 50 ? 'Complete Lesson' : 'Try Again'}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
        <span className="text-sm text-muted-foreground font-mono">Question {qIndex + 1}/{questions.length}</span>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {questions.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < qIndex ? 'bg-success' : i === qIndex ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={qIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
          <h3 className="text-xl font-semibold mb-6">{q.question}</h3>
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              let style = 'bg-secondary border-border hover:border-primary/50';
              if (answered) {
                if (i === q.correctIndex) style = 'bg-success/10 border-success';
                else if (i === selected) style = 'bg-destructive/10 border-destructive';
                else style = 'bg-secondary/50 border-border opacity-50';
              }
              return (
                <motion.button
                  key={i}
                  whileHover={!answered ? { scale: 1.01 } : {}}
                  whileTap={!answered ? { scale: 0.99 } : {}}
                  onClick={() => handleSelect(i)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${style} ${!answered ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-mono font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {answered && i === q.correctIndex && <CheckCircle2 className="w-5 h-5 text-success" />}
                    {answered && i === selected && i !== q.correctIndex && <XCircle className="w-5 h-5 text-destructive" />}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {answered && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-success/5 border-success/30' : 'bg-destructive/5 border-destructive/30'}`}>
                <p className="text-sm font-medium mb-1">{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</p>
                <p className="text-sm text-muted-foreground">{q.explanation}</p>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleNext} className="gap-2">
                  {qIndex + 1 >= questions.length ? 'See Results' : 'Next'} <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
