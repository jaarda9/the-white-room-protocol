import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { KnowledgeDomain, KnowledgeTopic, QuizQuestion, QuizResult } from '@/lib/types';
import { getKnowledgeData, saveKnowledgeData } from '@/lib/storage';

interface KnowledgeQuizProps {
  domain: KnowledgeDomain;
  domainInfo: { name: string; icon: string; description: string };
  topic: KnowledgeTopic;
  quiz: QuizQuestion[];
  onComplete: (result: QuizResult) => void;
  onBack: () => void;
}

export function KnowledgeQuiz({
  domain,
  domainInfo,
  topic,
  quiz,
  onComplete,
  onBack,
}: KnowledgeQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(new Array(quiz.length).fill(null));
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const [startTime] = useState(Date.now());
  const [isActive, setIsActive] = useState(true);

  // Load partial progress if exists
  useEffect(() => {
    const knowledgeData = getKnowledgeData(domain);
    if (knowledgeData.partialAnswers && knowledgeData.partialIndex !== undefined) {
      setAnswers(knowledgeData.partialAnswers);
      setCurrentIndex(Math.min(knowledgeData.partialIndex, quiz.length - 1));
    }
  }, [domain, quiz.length]);

  const handleSubmit = useCallback(() => {
    setIsActive(false);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    let correctAnswers = 0;
    const results = quiz.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      if (isCorrect) correctAnswers++;
      
      return {
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const score = Math.round((correctAnswers / quiz.length) * 100);
    
    const result: QuizResult = {
      score,
      correctAnswers,
      totalQuestions: quiz.length,
      results,
      timeTaken,
      timestamp: new Date().toISOString(),
    };

    // Clear partial progress
    const knowledgeData = getKnowledgeData(domain);
    knowledgeData.partialAnswers = undefined;
    knowledgeData.partialIndex = undefined;
    saveKnowledgeData(domain, knowledgeData);

    onComplete(result);
  }, [answers, quiz, startTime, domain, onComplete]);

  // Timer
  useEffect(() => {
    if (!isActive || timeLeft <= 0) {
      if (timeLeft <= 0 && isActive) {
        handleSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft, handleSubmit]);

  // Save progress on answer change
  useEffect(() => {
    const knowledgeData = getKnowledgeData(domain);
    knowledgeData.partialAnswers = answers;
    knowledgeData.partialIndex = currentIndex;
    saveKnowledgeData(domain, knowledgeData);
  }, [answers, currentIndex, domain]);

  const handleAnswer = (answer: string) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentQuestion = quiz[currentIndex];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((currentIndex + 1) / quiz.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col gap-4 sm:gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={onBack} className="w-full sm:w-auto justify-start">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Topic
            </Button>
            <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className={`font-mono text-lg ${timeLeft <= 30 ? 'text-destructive' : timeLeft <= 60 ? 'text-yellow-500' : ''}`}>
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {currentIndex + 1}/{quiz.length}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4">
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="p-5 sm:p-6 space-y-6">
          <div>
            <Badge variant="secondary" className="mb-3">
              {currentQuestion.type.replace('_', ' ').toUpperCase()}
            </Badge>
            <h2 className="text-xl font-bold mb-4">{currentQuestion.question}</h2>
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentIndex] === option;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 text-sm sm:text-base transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-primary bg-primary' : 'border-border'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                    </div>
                    <span>{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {currentIndex === quiz.length - 1 ? (
              <Button onClick={handleSubmit} disabled={!answers[currentIndex]} className="w-full sm:w-auto">
                Submit Quiz
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!answers[currentIndex]} className="w-full sm:w-auto">
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

