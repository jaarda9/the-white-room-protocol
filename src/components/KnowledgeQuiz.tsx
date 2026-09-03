import { useState, useEffect, useCallback, useRef } from 'react';
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
  const didAutoSubmitRef = useRef(false);

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

  // Accurate countdown timer: compute remaining from Date.now() so it keeps working in background tabs.
  useEffect(() => {
    if (!isActive) return;

    didAutoSubmitRef.current = false;
    const quizDurationSeconds = 180;

    const computeRemaining = () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      return Math.max(0, quizDurationSeconds - elapsedSeconds);
    };

    const update = () => {
      const remaining = computeRemaining();
      setTimeLeft(remaining);
      if (remaining <= 0 && !didAutoSubmitRef.current) {
        didAutoSubmitRef.current = true;
        handleSubmit();
      }
    };

    update();
    const intervalId = window.setInterval(update, 500);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isActive, startTime, handleSubmit]);

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
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <div className="border-b border-white/20 bg-[#061222]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)] w-max"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>[ RETURN TO TOPIC ]</span>
            </button>
            <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end">
              <div className="flex items-center gap-2 px-3 py-1 bg-black/50 border border-white/30 rounded-[2px]">
                <Clock className="w-4 h-4 text-[#9fd3ff]" />
                <span className={`font-mono text-base font-bold ${timeLeft <= 30 ? 'text-red-400 animate-pulse' : timeLeft <= 60 ? 'text-yellow-400' : 'text-white'}`}>
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
              <div className="text-xs font-mono border border-white/40 px-2.5 py-1 text-white bg-black/50">
                QUESTION {currentIndex + 1} / {quiz.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-[#061424] border border-white/30 h-2 p-[1px]">
          <div
            className="h-full bg-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.8)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown space-y-6">
          <div className="border-b border-white/20 pb-4">
            <span className="inline-block text-[10px] font-mono border border-white/40 px-2 py-0.5 text-[#9fd3ff] bg-black/50 mb-3">
              {currentQuestion.type.replace('_', ' ').toUpperCase()}
            </span>
            <h2 className="text-lg sm:text-xl font-bold font-mono text-white anime-glow-text">{currentQuestion.question}</h2>
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentIndex] === option;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-[2px] border text-xs sm:text-sm font-mono transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-white bg-white/20 text-white shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                      : 'border-white/30 bg-[#061424]/60 text-gray-300 hover:border-white/60 hover:bg-[#0a1f38]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#9fd3ff] font-bold">{String.fromCharCode(65 + index)}.</span>
                    <span>{option}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[#9fd3ff] text-xs font-bold">[ SELECTED ]</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-white/20">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-4 py-2 border border-white/40 bg-black/40 text-gray-300 hover:text-white hover:border-white font-mono text-xs disabled:opacity-40 disabled:hover:border-white/40 flex items-center justify-center gap-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </button>

            {currentIndex === quiz.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={!answers[currentIndex]}
                className="px-6 py-2 border border-white/70 bg-white/15 hover:bg-white/30 text-white font-mono font-bold text-xs shadow-[0_0_15px_rgba(0,212,255,0.25)] disabled:opacity-40"
              >
                SUBMIT TRIAL
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!answers[currentIndex]}
                className="px-6 py-2 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-xs shadow-[0_0_10px_rgba(0,212,255,0.2)] disabled:opacity-40 flex items-center justify-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

