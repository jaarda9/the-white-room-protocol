import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, Lock, Unlock, CheckCircle2, ChevronRight, Star, RotateCcw } from 'lucide-react';
import {
  knowledgeContentMap,
  getProgress,
  markLessonComplete,
  getQuizScore,
  saveQuizScore,
  type KnowledgeDomainContent,
  type Topic,
  type Lesson,
  type QuizQuestion,
} from '@/lib/knowledge-content';

type View = 'domains' | 'topics' | 'lesson' | 'quiz' | 'results';

export default function ResearchLab() {
  const navigate = useNavigate();

  const [view, setView] = useState<View>('domains');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomainContent | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);

  const domains = useMemo(() => Object.values(knowledgeContentMap), []);

  const progress = useMemo(() => {
    if (!selectedDomain) return {};
    return getProgress(selectedDomain.id);
  }, [selectedDomain, view]);

  const domainProgress = (domain: KnowledgeDomainContent) => {
    const p = getProgress(domain.id);
    const totalLessons = domain.topics.reduce((s, t) => s + t.lessons.length, 0);
    const completed = Object.keys(p).filter(k => p[k]).length;
    return totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
  };

  const isLessonUnlocked = (topic: Topic, lessonIdx: number) => {
    if (lessonIdx === 0) return true;
    const prevLesson = topic.lessons[lessonIdx - 1];
    return !!progress[prevLesson.id];
  };

  // ── Navigation helpers ──
  const openDomain = (d: KnowledgeDomainContent) => {
    setSelectedDomain(d);
    setView('topics');
  };

  const openTopic = (t: Topic) => {
    setSelectedTopic(t);
    setView('topics'); // stays on topics, we show lessons within topic
  };

  const openLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setView('lesson');
  };

  const startQuiz = () => {
    if (!selectedLesson) return;
    setQuizIndex(0);
    setQuizAnswers([]);
    setShowExplanation(false);
    setView('quiz');
  };

  const answerQuiz = (optionIdx: number) => {
    if (showExplanation) return;
    setQuizAnswers([...quizAnswers, optionIdx]);
    setShowExplanation(true);
  };

  const nextQuizQuestion = () => {
    if (!selectedLesson) return;
    setShowExplanation(false);
    if (quizIndex + 1 < selectedLesson.quiz.length) {
      setQuizIndex(quizIndex + 1);
    } else {
      // Calculate results
      const correct = quizAnswers.reduce(
        (s, a, i) => s + (a === selectedLesson.quiz[i].correctIndex ? 1 : 0),
        0
      );
      // Include last answer
      const lastCorrect = quizAnswers[quizAnswers.length - 1] === selectedLesson.quiz[quizIndex].correctIndex ? 1 : 0;
      const totalCorrect = quizAnswers.slice(0, -1).reduce(
        (s, a, i) => s + (a === selectedLesson.quiz[i].correctIndex ? 1 : 0),
        0
      ) + lastCorrect;

      saveQuizScore(selectedLesson.id, totalCorrect, selectedLesson.quiz.length);
      if (totalCorrect >= Math.ceil(selectedLesson.quiz.length * 0.5) && selectedDomain) {
        markLessonComplete(selectedDomain.id, selectedLesson.id);
      }
      setView('results');
    }
  };

  const goBack = () => {
    if (view === 'results' || view === 'quiz') {
      setView('lesson');
    } else if (view === 'lesson') {
      setView('topics');
    } else if (view === 'topics') {
      if (selectedTopic) {
        setSelectedTopic(null);
      } else {
        setSelectedDomain(null);
        setView('domains');
      }
    } else {
      navigate(-1);
    }
  };

  // ── RENDER ──

  const renderHeader = (title: string, subtitle?: string) => (
    <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={goBack} className="font-mono-data">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary flex-shrink-0" />
              <span className="line-clamp-1">{title}</span>
            </h1>
            {subtitle && <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{subtitle}</p>}
          </div>
        </div>
      </div>
    </header>
  );

  // ── DOMAINS VIEW ──
  if (view === 'domains') {
    return (
      <div className="min-h-screen bg-background">
        {renderHeader('Research Dungeon', 'Choose a knowledge domain to explore')}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {domains.map((d) => {
              const pct = domainProgress(d);
              return (
                <Card
                  key={d.id}
                  className="p-5 cursor-pointer hover:border-primary/50 transition-all group"
                  onClick={() => openDomain(d)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{d.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{d.name}</h3>
                      <p className="text-xs text-muted-foreground">{d.topics.length} topic{d.topics.length > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <Progress value={pct} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{pct}% explored</p>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── TOPICS / LESSONS VIEW ──
  if (view === 'topics' && selectedDomain) {
    const showingTopic = selectedTopic;

    if (showingTopic) {
      // Show lessons for this topic (dungeon map style)
      return (
        <div className="min-h-screen bg-background">
          {renderHeader(`${showingTopic.icon} ${showingTopic.name}`, showingTopic.description)}
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border hidden sm:block" />

              <div className="space-y-4">
                {showingTopic.lessons.map((lesson, idx) => {
                  const unlocked = isLessonUnlocked(showingTopic, idx);
                  const completed = !!progress[lesson.id];
                  const score = getQuizScore(lesson.id);

                  return (
                    <div key={lesson.id} className="relative flex items-start gap-4">
                      {/* Node dot */}
                      <div className={`hidden sm:flex w-12 h-12 rounded-full items-center justify-center flex-shrink-0 border-2 z-10 ${
                        completed ? 'bg-primary/20 border-primary text-primary' :
                        unlocked ? 'bg-card border-border text-foreground' :
                        'bg-muted border-muted-foreground/30 text-muted-foreground'
                      }`}>
                        {completed ? <CheckCircle2 className="w-5 h-5" /> :
                         unlocked ? <span className="font-bold text-sm">{idx + 1}</span> :
                         <Lock className="w-4 h-4" />}
                      </div>

                      <Card
                        className={`flex-1 p-4 transition-all ${
                          unlocked ? 'cursor-pointer hover:border-primary/50' : 'opacity-50 cursor-not-allowed'
                        } ${completed ? 'border-primary/30' : ''}`}
                        onClick={() => unlocked && openLesson(lesson)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-sm sm:text-base">{lesson.title}</h3>
                              {completed && <Badge variant="secondary" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">⏱ {lesson.duration}</span>
                              <span className="text-xs text-muted-foreground">{lesson.quiz.length} quiz Q</span>
                              {score && <span className="text-xs text-primary">★ {score.score}/{score.total}</span>}
                            </div>
                          </div>
                          {unlocked ? (
                            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show topic selection
    return (
      <div className="min-h-screen bg-background">
        {renderHeader(`${selectedDomain.icon} ${selectedDomain.name}`, 'Select a dungeon to explore')}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
          <div className="grid gap-4">
            {selectedDomain.topics.map((topic) => {
              const completedLessons = topic.lessons.filter(l => progress[l.id]).length;
              const pct = topic.lessons.length > 0 ? Math.round((completedLessons / topic.lessons.length) * 100) : 0;

              return (
                <Card
                  key={topic.id}
                  className="p-5 cursor-pointer hover:border-primary/50 transition-all group"
                  onClick={() => openTopic(topic)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{topic.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold group-hover:text-primary transition-colors">{topic.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{topic.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">{completedLessons}/{topic.lessons.length}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── LESSON VIEW ──
  if (view === 'lesson' && selectedLesson) {
    return (
      <div className="min-h-screen bg-background">
        {renderHeader(selectedLesson.title, `⏱ ${selectedLesson.duration} read`)}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-6">
          {/* Content paragraphs */}
          <div className="space-y-4">
            {selectedLesson.content.map((para, i) => (
              <p key={i} className="text-sm sm:text-base leading-relaxed text-foreground/90">{para}</p>
            ))}
          </div>

          {/* Key Facts */}
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" /> Key Facts
            </h3>
            <ul className="space-y-2">
              {selectedLesson.keyFacts.map((fact, i) => (
                <li key={i} className="text-xs sm:text-sm text-foreground/80 flex items-start gap-2">
                  <span className="text-primary mt-0.5">▸</span>
                  {fact}
                </li>
              ))}
            </ul>
          </Card>

          {/* Quiz CTA */}
          <div className="pt-4 border-t border-border">
            <Button onClick={startQuiz} className="w-full">
              Take the Quiz ({selectedLesson.quiz.length} questions) →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUIZ VIEW ──
  if (view === 'quiz' && selectedLesson) {
    const q: QuizQuestion = selectedLesson.quiz[quizIndex];
    const userAnswer = quizAnswers[quizIndex];
    const isCorrect = userAnswer === q.correctIndex;

    return (
      <div className="min-h-screen bg-background">
        {renderHeader(`Quiz: ${selectedLesson.title}`, `Question ${quizIndex + 1} of ${selectedLesson.quiz.length}`)}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            {selectedLesson.quiz.map((_, i) => (
              <div key={i} className={`h-2 flex-1 rounded-full ${
                i < quizIndex ? 'bg-primary' :
                i === quizIndex ? 'bg-primary/50' : 'bg-muted'
              }`} />
            ))}
          </div>

          <h2 className="text-lg sm:text-xl font-bold">{q.question}</h2>

          <div className="space-y-3">
            {q.options.map((opt, i) => {
              let variant: 'outline' | 'default' | 'destructive' | 'secondary' = 'outline';
              if (showExplanation) {
                if (i === q.correctIndex) variant = 'default';
                else if (i === userAnswer && !isCorrect) variant = 'destructive';
                else variant = 'secondary';
              }

              return (
                <Button
                  key={i}
                  variant={variant}
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => answerQuiz(i)}
                  disabled={showExplanation}
                >
                  <span className="font-mono mr-3 text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </Button>
              );
            })}
          </div>

          {showExplanation && (
            <Card className={`p-4 ${isCorrect ? 'border-primary/50 bg-primary/5' : 'border-destructive/50 bg-destructive/5'}`}>
              <p className="text-sm font-bold mb-1">{isCorrect ? '✅ Correct!' : '❌ Incorrect'}</p>
              <p className="text-xs sm:text-sm text-foreground/80">{q.explanation}</p>
              <Button onClick={nextQuizQuestion} className="mt-3" size="sm">
                {quizIndex + 1 < selectedLesson.quiz.length ? 'Next Question →' : 'See Results →'}
              </Button>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── RESULTS VIEW ──
  if (view === 'results' && selectedLesson) {
    const score = getQuizScore(selectedLesson.id);
    const passed = score && score.score >= Math.ceil(score.total * 0.5);

    return (
      <div className="min-h-screen bg-background">
        {renderHeader('Quiz Results')}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8">
          <Card className="p-6 text-center space-y-4">
            <div className="text-5xl">{passed ? '🏆' : '📚'}</div>
            <h2 className="text-2xl font-bold">{passed ? 'Dungeon Cleared!' : 'Keep Studying'}</h2>
            <p className="text-muted-foreground">
              You scored <span className="text-primary font-bold">{score?.score}</span> out of <span className="font-bold">{score?.total}</span>
            </p>
            {passed ? (
              <p className="text-sm text-primary">✓ Lesson completed — next lesson unlocked!</p>
            ) : (
              <p className="text-sm text-muted-foreground">Score at least 50% to unlock the next lesson.</p>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => { setView('lesson'); }}>
                <RotateCcw className="w-4 h-4 mr-2" /> Review Lesson
              </Button>
              <Button onClick={() => {
                setSelectedLesson(null);
                setView('topics');
              }}>
                Back to Map
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
