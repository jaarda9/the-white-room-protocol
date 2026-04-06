import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  completeResearchLessonNode,
  getProgress,
  getQuizScore,
  getResearchProgressMeta,
  knowledgeContentMap,
  RESEARCH_ACHIEVEMENTS,
  type KnowledgeDomainContent,
  type Lesson,
} from "@/lib/knowledge-content";
import { ArrowLeft, BookOpen, Brain, CheckCircle2, ChevronRight, Flame, Lock, Map, Star, Trophy, User, Zap } from "lucide-react";

type View = "domains" | "map" | "lesson" | "quiz" | "results" | "profile";
type NodeStatus = "locked" | "available" | "completed";

interface LessonNode {
  id: string;
  domainId: string;
  topicId: string;
  topicName: string;
  topicIcon: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  xpReward: number;
  prerequisites: string[];
  lesson: Lesson;
  isBonus: boolean;
  x: number;
  y: number;
}

export default function ResearchLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<View>("domains");
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomainContent | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [lessonStep, setLessonStep] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finishedScore, setFinishedScore] = useState<{ score: number; total: number } | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  const domains = useMemo(() => Object.values(knowledgeContentMap), []);
  const progress = useMemo(
    () => (selectedDomain ? getProgress(selectedDomain.id) : {}),
    [selectedDomain, view, profileVersion]
  );
  const meta = useMemo(() => getResearchProgressMeta(), [profileVersion, view]);

  const nodes = useMemo<LessonNode[]>(() => {
    if (!selectedDomain) return [];
    const topicCount = Math.max(1, selectedDomain.topics.length);
    const out: LessonNode[] = [];

    selectedDomain.topics.forEach((topic, topicIndex) => {
      topic.lessons.forEach((lesson, lessonIndex) => {
        const prev = topic.lessons[lessonIndex - 1];
        const x = Math.round(((topicIndex + 1) / (topicCount + 1)) * 100);
        const y = 18 + lessonIndex * 24;
        out.push({
          id: lesson.id,
          domainId: selectedDomain.id,
          topicId: topic.id,
          topicName: topic.name,
          topicIcon: topic.icon,
          title: lesson.title,
          description: lesson.content[0] || topic.description,
          estimatedMinutes: Number.parseInt(lesson.duration, 10) || 5,
          xpReward: 100 + lessonIndex * 15,
          prerequisites: prev ? [prev.id] : [],
          lesson,
          isBonus: lesson.id.toLowerCase().includes("bonus"),
          x,
          y,
        });
      });
    });

    return out;
  }, [selectedDomain]);

  const activeNode = useMemo(
    () => nodes.find((n) => n.id === activeNodeId) ?? null,
    [nodes, activeNodeId]
  );

  const domainProgress = (domain: KnowledgeDomainContent): number => {
    const p = getProgress(domain.id);
    const totalLessons = domain.topics.reduce((sum, topic) => sum + topic.lessons.length, 0);
    const completed = Object.keys(p).filter((k) => p[k]).length;
    return totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
  };

  const getNodeStatus = (node: LessonNode): NodeStatus => {
    if (progress[node.id]) return "completed";
    const unlocked = node.prerequisites.every((pr) => progress[pr]);
    return unlocked ? "available" : "locked";
  };

  const openDomain = (domain: KnowledgeDomainContent): void => {
    setSelectedDomain(domain);
    setActiveNodeId(null);
    setView("map");
  };

  const openNode = (node: LessonNode): void => {
    if (getNodeStatus(node) === "locked") return;
    setActiveNodeId(node.id);
    setLessonStep(0);
    setView("lesson");
  };

  const startQuiz = (): void => {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setCorrectCount(0);
    setFinishedScore(null);
    setView("quiz");
  };

  const handleSelectAnswer = (idx: number): void => {
    if (!activeNode || answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
    if (idx === activeNode.lesson.quiz[quizIndex].correctIndex) {
      setCorrectCount((v) => v + 1);
    }
  };

  const handleQuizNext = (): void => {
    if (!activeNode) return;
    const total = activeNode.lesson.quiz.length;
    if (quizIndex + 1 >= total) {
      const score = correctCount;
      setFinishedScore({ score, total });
      const result = completeResearchLessonNode({
        domainId: activeNode.domainId,
        lessonId: activeNode.id,
        score,
        total,
        xpReward: activeNode.xpReward,
      });
      if (result.unlockedAchievements.length > 0) {
        toast({
          title: "Achievement Unlocked",
          description: `${result.unlockedAchievements.length} new research achievement(s) unlocked.`,
        });
      }
      setProfileVersion((v) => v + 1);
      setView("results");
      return;
    }
    setQuizIndex((v) => v + 1);
    setSelectedAnswer(null);
    setAnswered(false);
  };

  const goBack = (): void => {
    if (view === "results") {
      setView("map");
      return;
    }
    if (view === "quiz") {
      setView("lesson");
      return;
    }
    if (view === "lesson" || view === "profile") {
      setView("map");
      return;
    }
    if (view === "map") {
      setSelectedDomain(null);
      setView("domains");
      return;
    }
    navigate(-1);
  };

  const renderHeader = (title: string, subtitle?: string) => (
    <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={goBack} className="font-mono-data">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Map className="w-6 h-6 text-primary flex-shrink-0" />
              <span className="line-clamp-1">{title}</span>
            </h1>
            {subtitle ? <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{subtitle}</p> : null}
          </div>
          {selectedDomain && view !== "domains" ? (
            <button
              type="button"
              onClick={() => setView(view === "profile" ? "map" : "profile")}
              className="w-9 h-9 rounded-full border border-border hover:border-primary/50 flex items-center justify-center"
              title="Research profile"
            >
              <User className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );

  if (view === "domains") {
    return (
      <div className="min-h-screen bg-background">
        {renderHeader("Research Navigator", "Choose a domain to start your learning map")}
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 grid gap-4 sm:grid-cols-2">
          {domains.map((domain) => {
            const pct = domainProgress(domain);
            return (
              <Card
                key={domain.id}
                className="p-5 cursor-pointer hover:border-primary/50 transition-all group"
                onClick={() => openDomain(domain)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{domain.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{domain.name}</h3>
                    <p className="text-xs text-muted-foreground">{domain.topics.length} topic paths</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <Progress value={pct} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{pct}% explored</p>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (!selectedDomain) return null;

  if (view === "profile") {
    const unlocked = RESEARCH_ACHIEVEMENTS.filter((a) => meta.achievements.includes(a.id));
    const completion = Math.round((Object.keys(progress).filter((k) => progress[k]).length / Math.max(1, nodes.length)) * 100);
    const scored = nodes.map((n) => getQuizScore(n.id)).filter((s): s is { score: number; total: number } => !!s);
    const avgScore = scored.length > 0 ? Math.round(scored.reduce((sum, s) => sum + Math.round((s.score / s.total) * 100), 0) / scored.length) : 0;

    return (
      <div className="min-h-screen bg-background">
        {renderHeader(`${selectedDomain.icon} ${selectedDomain.name}`, "Research profile and achievements")}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <Zap className="w-4 h-4 text-primary" />, label: "XP", value: meta.xp },
              { icon: <Flame className="w-4 h-4 text-orange-500" />, label: "Streak", value: `${meta.streak}d` },
              { icon: <BookOpen className="w-4 h-4 text-blue-500" />, label: "Completed", value: `${Object.keys(progress).filter((k) => progress[k]).length}/${nodes.length}` },
              { icon: <Trophy className="w-4 h-4 text-yellow-500" />, label: "Avg Score", value: `${avgScore}%` },
            ].map((item) => (
              <Card key={item.label} className="p-4 text-center">
                <div className="flex justify-center mb-2">{item.icon}</div>
                <p className="text-xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Domain Completion</p>
              <p className="text-sm text-primary font-mono">{completion}%</p>
            </div>
            <Progress value={completion} className="h-2" />
          </Card>

          <Card className="p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Achievements
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {RESEARCH_ACHIEVEMENTS.map((a) => {
                const ok = unlocked.some((u) => u.id === a.id);
                return (
                  <div
                    key={a.id}
                    className={`p-3 rounded-lg border ${ok ? "border-primary/40 bg-primary/5" : "border-border opacity-55"}`}
                  >
                    <p className="text-sm font-medium">{a.icon} {a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (view === "map") {
    return (
      <div className="min-h-screen bg-background">
        {renderHeader(`${selectedDomain.icon} ${selectedDomain.name}`, "Navigate the map. Complete nodes to unlock next ones.")}
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
          <Card className="p-4 sm:p-6 relative overflow-x-auto">
            <div className="relative min-w-[680px]" style={{ height: 520 }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {nodes.flatMap((node) =>
                  node.prerequisites.map((pr) => {
                    const from = nodes.find((n) => n.id === pr);
                    if (!from) return null;
                    const active = progress[pr];
                    return (
                      <line
                        key={`${pr}-${node.id}`}
                        x1={`${from.x}%`}
                        y1={`${from.y}%`}
                        x2={`${node.x}%`}
                        y2={`${node.y}%`}
                        stroke={active ? "hsl(var(--primary) / 0.55)" : "hsl(var(--muted-foreground) / 0.25)"}
                        strokeWidth={active ? 2.2 : 1.4}
                        strokeDasharray={active ? "none" : "6 4"}
                      />
                    );
                  })
                )}
              </svg>

              {nodes.map((node) => {
                const status = getNodeStatus(node);
                const isLocked = status === "locked";
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => openNode(node)}
                    disabled={isLocked}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-left group"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center mb-1 mx-auto transition-all ${
                        status === "completed"
                          ? "border-primary bg-primary/15 text-primary"
                          : status === "available"
                            ? "border-primary/70 bg-card group-hover:scale-105"
                            : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {status === "completed" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Brain className="w-4 h-4" />
                      )}
                    </div>
                    <p className={`text-[11px] leading-tight w-[120px] text-center ${isLocked ? "text-muted-foreground/60" : "text-foreground"}`}>
                      {node.topicIcon} {node.title}
                    </p>
                    {node.isBonus ? <Badge variant="secondary" className="mt-1 text-[10px]">Bonus</Badge> : null}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!activeNode) return null;

  if (view === "lesson") {
    const sections = activeNode.lesson.content;
    const showingSummary = lessonStep >= sections.length;

    return (
      <div className="min-h-screen bg-background">
        {renderHeader(activeNode.title, `${activeNode.estimatedMinutes} min read • ${activeNode.topicName}`)}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
          <div className="flex gap-1 mb-6">
            {[...sections, ""].map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= lessonStep ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          <Card className="p-5 sm:p-6">
            {!showingSummary ? (
              <>
                <h3 className="text-lg font-bold mb-3">Section {lessonStep + 1}</h3>
                <p className="text-sm sm:text-base leading-relaxed text-foreground/90">{sections[lessonStep]}</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Key Takeaways
                </h3>
                <ul className="space-y-2">
                  {activeNode.lesson.keyFacts.map((fact, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-primary">{i + 1}.</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <div className="flex justify-between mt-4">
            <Button variant="ghost" disabled={lessonStep === 0} onClick={() => setLessonStep((s) => Math.max(0, s - 1))}>
              Previous
            </Button>
            {showingSummary ? (
              <Button onClick={startQuiz}>Start Quiz</Button>
            ) : (
              <Button onClick={() => setLessonStep((s) => s + 1)}>
                {lessonStep === sections.length - 1 ? "Summary" : "Next"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "quiz") {
    const q = activeNode.lesson.quiz[quizIndex];
    const isCorrect = selectedAnswer === q.correctIndex;
    const progressPct = ((quizIndex + 1) / activeNode.lesson.quiz.length) * 100;

    return (
      <div className="min-h-screen bg-background">
        {renderHeader(`Quiz: ${activeNode.title}`, `Question ${quizIndex + 1} / ${activeNode.lesson.quiz.length}`)}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
          <Progress value={progressPct} className="h-2 mb-5" />
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold mb-4">{q.question}</h3>
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                const style = answered
                  ? i === q.correctIndex
                    ? "border-primary bg-primary/10"
                    : i === selectedAnswer
                      ? "border-destructive bg-destructive/10"
                      : "border-border opacity-70"
                  : "border-border hover:border-primary/50";
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={answered}
                    onClick={() => handleSelectAnswer(i)}
                    className={`w-full text-left rounded-lg border-2 p-3 transition-all ${style}`}
                  >
                    <span className="font-mono text-xs mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {answered ? (
              <Card className={`mt-4 p-3 ${isCorrect ? "border-primary/50 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
                <p className="text-sm font-semibold">{isCorrect ? "Correct" : "Incorrect"}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{q.explanation}</p>
                <Button size="sm" onClick={handleQuizNext} className="mt-3">
                  {quizIndex + 1 >= activeNode.lesson.quiz.length ? "See Results" : "Next"}
                </Button>
              </Card>
            ) : null}
          </Card>
        </div>
      </div>
    );
  }

  if (view === "results") {
    const finalScore = finishedScore ?? getQuizScore(activeNode.id) ?? { score: 0, total: 1 };
    const pct = Math.round((finalScore.score / Math.max(1, finalScore.total)) * 100);
    const passed = pct >= 50;

    return (
      <div className="min-h-screen bg-background">
        {renderHeader("Node Results")}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8">
          <Card className="p-6 text-center space-y-4">
            <div className="text-5xl">{passed ? "🏆" : "📚"}</div>
            <h2 className="text-2xl font-bold">{passed ? "Node Cleared" : "Retry Needed"}</h2>
            <p className="text-muted-foreground">
              Score: <span className="text-primary font-bold">{finalScore.score}</span> / {finalScore.total} ({pct}%)
            </p>
            <p className="text-sm text-muted-foreground">
              {passed ? `+${activeNode.xpReward} XP granted.` : "Pass threshold is 50%."}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setView("lesson")}>
                Review Lesson
              </Button>
              <Button onClick={() => setView("map")}>
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
