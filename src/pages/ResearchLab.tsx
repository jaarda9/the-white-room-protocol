import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import type { Attributes } from "@/lib/types";
import { getUserProfile } from "@/lib/storage";
import { ArrowLeft, BookOpen, Brain, CheckCircle2, ChevronRight, Flame, Lock, Map, Sparkles, Star, Trophy, User, Zap } from "lucide-react";

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

/** 0–100 coordinates; zigzag bottom → top (matches skill-tree trace order, cycles if many nodes). */
const NODE_LAYOUT_TEMPLATE: Array<{ x: number; y: number }> = [
  { x: 50, y: 90 },
  { x: 28, y: 76 },
  { x: 72, y: 64 },
  { x: 22, y: 52 },
  { x: 78, y: 42 },
  { x: 35, y: 30 },
  { x: 65, y: 20 },
  { x: 88, y: 14 },
  { x: 12, y: 14 },
  { x: 50, y: 8 },
  { x: 30, y: 38 },
  { x: 70, y: 26 },
];

interface ResearchMapCanvasProps {
  nodes: LessonNode[];
  progress: Record<string, boolean>;
  getNodeStatus: (node: LessonNode) => NodeStatus;
  openNode: (node: LessonNode) => void;
}

/** Lines use measured icon centers so they stay aligned with the rendered buttons (CSS % layout + transforms). */
function ResearchMapCanvas({ nodes, progress, getNodeStatus, openNode }: ResearchMapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [metrics, setMetrics] = useState<{
    w: number;
    h: number;
    centers: { x: number; y: number }[];
  } | null>(null);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) {
      setMetrics(null);
      return;
    }
    const cr = canvas.getBoundingClientRect();
    if (cr.width < 1 || cr.height < 1) {
      setMetrics(null);
      return;
    }
    const centers: { x: number; y: number }[] = [];
    for (const node of nodes) {
      const btn = iconRefs.current[node.id];
      if (!btn) {
        setMetrics(null);
        return;
      }
      const br = btn.getBoundingClientRect();
      centers.push({
        x: br.left + br.width / 2 - cr.left,
        y: br.top + br.height / 2 - cr.top,
      });
    }
    setMetrics({ w: cr.width, h: cr.height, centers });
  }, [nodes]);

  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(() => measure());
    const canvas = canvasRef.current;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    if (canvas) ro.observe(canvas);
    window.addEventListener("resize", measure);
    const fonts = document.fonts?.ready;
    if (fonts) void fonts.then(() => measure());
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, nodes]);

  useLayoutEffect(() => {
    requestAnimationFrame(measure);
  }, [measure, progress]);

  return (
    <div
      ref={canvasRef}
      className="relative mx-auto w-full research-map-canvas"
      style={{
        aspectRatio: "10 / 16",
        minHeight: "min(72vh, 560px)",
        maxHeight: "min(90vh, 640px)",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox={metrics ? `0 0 ${metrics.w} ${metrics.h}` : "0 0 100 100"}
        preserveAspectRatio="none"
        aria-hidden
      >
        {metrics && metrics.centers.length > 1
          ? metrics.centers.slice(0, -1).map((fromPt, i) => {
              const toPt = metrics.centers[i + 1];
              const fromNode = nodes[i];
              const segmentCompleted = !!progress[fromNode.id];
              return (
                <line
                  key={`path-${fromNode.id}-${nodes[i + 1].id}`}
                  x1={fromPt.x}
                  y1={fromPt.y}
                  x2={toPt.x}
                  y2={toPt.y}
                  stroke={
                    segmentCompleted
                      ? "hsl(142 71% 48% / 0.9)"
                      : "hsl(var(--muted-foreground) / 0.4)"
                  }
                  strokeWidth={segmentCompleted ? 2.5 : 1.75}
                  strokeLinecap="round"
                  strokeDasharray={segmentCompleted ? undefined : "6 6"}
                />
              );
            })
          : nodes.length > 1
            ? nodes.slice(0, -1).map((from, i) => {
                const segmentCompleted = !!progress[from.id];
                return (
                  <line
                    key={`path-fallback-${from.id}-${to.id}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={
                      segmentCompleted
                        ? "hsl(142 71% 48% / 0.9)"
                        : "hsl(var(--muted-foreground) / 0.4)"
                    }
                    strokeWidth={segmentCompleted ? 1.1 : 0.75}
                    strokeLinecap="round"
                    strokeDasharray={segmentCompleted ? undefined : "2.2 2"}
                  />
                );
              })
            : null}
      </svg>

      {nodes.map((node, i) => {
        const status = getNodeStatus(node);
        const isLocked = status === "locked";
        const pulse = status === "available";
        return (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className="relative research-node-enter"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <button
                type="button"
                ref={(el) => {
                  iconRefs.current[node.id] = el;
                }}
                onClick={() => openNode(node)}
                disabled={isLocked}
                className={`group flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 transition-all sm:h-16 sm:w-16 ${
                  status === "completed"
                    ? "border-primary bg-primary/15 text-primary glow-success"
                    : status === "available"
                      ? "border-primary bg-secondary node-pulse hover:ring-2 hover:ring-primary/35 ring-offset-2 ring-offset-background"
                      : "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                }`}
              >
                {status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : isLocked ? (
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                )}
              </button>
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 flex w-[min(140px,46vw)] -translate-x-1/2 flex-col items-center gap-1 sm:mt-2 sm:w-40">
                <p
                  className={`text-center text-[10px] leading-tight sm:text-[11px] ${
                    isLocked ? "text-muted-foreground/60" : "text-foreground"
                  }`}
                >
                  <span className="mr-0.5">{node.topicIcon}</span>
                  {node.title}
                </p>
                {node.isBonus ? (
                  <Badge variant="secondary" className="text-[9px] sm:text-[10px]">
                    Bonus
                  </Badge>
                ) : null}
                {pulse ? (
                  <p className="font-mono text-[9px] text-primary sm:text-[10px]">+{node.xpReward} XP</p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const [finishedOutcome, setFinishedOutcome] = useState<{
    xpAwarded: number;
    attributeRewards: Partial<Attributes>;
  } | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  const domains = useMemo(() => Object.values(knowledgeContentMap), []);
  const progress = useMemo(
    () => (selectedDomain ? getProgress(selectedDomain.id) : {}),
    [selectedDomain, view, profileVersion]
  );
  const meta = useMemo(() => getResearchProgressMeta(), [profileVersion, view]);

  const nodes = useMemo<LessonNode[]>(() => {
    if (!selectedDomain) return [];
    const out: LessonNode[] = [];
    const flatLessons: Array<{
      topic: (typeof selectedDomain.topics)[number];
      lesson: Lesson;
      lessonIndex: number;
    }> = [];

    selectedDomain.topics.forEach((topic) => {
      topic.lessons.forEach((lesson, lessonIndex) => {
        flatLessons.push({ topic, lesson, lessonIndex });
      });
    });

    flatLessons.forEach((entry, globalIndex) => {
      const { topic, lesson, lessonIndex } = entry;
      const prevInTopic = topic.lessons[lessonIndex - 1];
      const prevTopicLast =
        lessonIndex === 0 && globalIndex > 0
          ? flatLessons[globalIndex - 1].topic.lessons.slice(-1)[0]
          : null;
      const prerequisites: string[] = [];
      if (prevInTopic) prerequisites.push(prevInTopic.id);
      else if (prevTopicLast) prerequisites.push(prevTopicLast.id);

      const layout = NODE_LAYOUT_TEMPLATE[globalIndex % NODE_LAYOUT_TEMPLATE.length];
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
        prerequisites,
        lesson,
        isBonus: lesson.id.toLowerCase().includes("bonus"),
        x: layout.x,
        y: layout.y,
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
    setFinishedOutcome(null);
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
      setFinishedOutcome({
        xpAwarded: result.xpAwarded,
        attributeRewards: result.attributeRewards,
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
      setFinishedOutcome(null);
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
      <div className="min-h-screen bg-background research-nav-bg">
        {renderHeader("Research Navigator", "Choose a domain to start your learning map")}
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 grid gap-4 sm:grid-cols-2">
          {domains.map((domain) => {
            const pct = domainProgress(domain);
            return (
              <Card
                key={domain.id}
                className="p-5 cursor-pointer hover:border-primary/50 transition-all group research-card-enter"
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
    const subjectProfile = getUserProfile();

    return (
      <div className="min-h-screen bg-background research-nav-bg">
        {renderHeader(`${selectedDomain.icon} ${selectedDomain.name}`, "Research profile and achievements")}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-4">
          <Card className="p-4 border-primary/30 bg-primary/5 research-fade-in">
            <p className="text-xs text-muted-foreground font-mono-data mb-1">SUBJECT PROFILE (GLOBAL)</p>
            <p className="text-sm">
              Level <span className="text-primary font-bold">{subjectProfile.level}</span> · XP{" "}
              <span className="font-mono-data text-primary">{subjectProfile.xp}</span> / {subjectProfile.xpToNextLevel}
            </p>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: <Zap className="w-4 h-4 text-primary" />, label: "Lab XP", value: meta.xp },
              { icon: <Zap className="w-4 h-4 text-accent" />, label: "Subject XP", value: subjectProfile.xp },
              { icon: <Flame className="w-4 h-4 text-orange-500" />, label: "Streak", value: `${meta.streak}d` },
              { icon: <BookOpen className="w-4 h-4 text-blue-500" />, label: "Completed", value: `${Object.keys(progress).filter((k) => progress[k]).length}/${nodes.length}` },
              { icon: <Trophy className="w-4 h-4 text-yellow-500" />, label: "Avg Score", value: `${avgScore}%` },
            ].map((item) => (
              <Card key={item.label} className="p-4 text-center research-card-enter">
                <div className="flex justify-center mb-2">{item.icon}</div>
                <p className="text-xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5 research-fade-in">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Domain Completion</p>
              <p className="text-sm text-primary font-mono">{completion}%</p>
            </div>
            <Progress value={completion} className="h-2" />
          </Card>

          <Card className="p-5 research-fade-in">
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
                    className={`p-3 rounded-lg border transition-all ${ok ? "border-primary/40 bg-primary/5 research-glow" : "border-border opacity-55"}`}
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
      <div className="min-h-screen bg-background research-nav-bg">
        {renderHeader(`${selectedDomain.icon} ${selectedDomain.name}`, "Navigate the map. Complete nodes to unlock next ones.")}
        <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
          <Card className="p-2 sm:p-4 md:p-6 research-map-shell overflow-visible">
            <ResearchMapCanvas nodes={nodes} progress={progress} getNodeStatus={getNodeStatus} openNode={openNode} />
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
      <div className="min-h-screen bg-background research-nav-bg">
        {renderHeader(activeNode.title, `${activeNode.estimatedMinutes} min read • ${activeNode.topicName}`)}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
          <div className="flex gap-1 mb-6">
            {[...sections, ""].map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= lessonStep ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          <Card key={lessonStep} className="p-5 sm:p-6 research-panel-enter border-primary/20">
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
                    <li key={i} className="text-sm flex gap-2 research-li-enter" style={{ animationDelay: `${i * 70}ms` }}>
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
      <div className="min-h-screen bg-background research-nav-bg">
        {renderHeader(`Quiz: ${activeNode.title}`, `Question ${quizIndex + 1} / ${activeNode.lesson.quiz.length}`)}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
          <Progress value={progressPct} className="h-2 mb-5" />
          <Card key={quizIndex} className="p-5 sm:p-6 research-panel-enter border-primary/20">
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
              <Card className={`mt-4 p-3 research-fade-in ${isCorrect ? "border-primary/50 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
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
    const subjectProfile = getUserProfile();
    const xpToSubject = finishedOutcome?.xpAwarded ?? 0;
    const attr = finishedOutcome?.attributeRewards ?? {};

    return (
      <div className="min-h-screen bg-background research-nav-bg">
        {renderHeader("Node Results")}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8">
          <Card className="p-6 text-center space-y-4 research-panel-enter border-primary/20">
            <div className="text-5xl research-pop">{passed ? "🏆" : "📚"}</div>
            <h2 className="text-2xl font-bold">{passed ? "Node Cleared" : "Retry Needed"}</h2>
            <p className="text-muted-foreground">
              Score: <span className="text-primary font-bold">{finalScore.score}</span> / {finalScore.total} ({pct}%)
            </p>
            <p className="text-sm text-muted-foreground">
              {passed
                ? "Rewards applied to your SUBJECT profile (global XP + hidden attribute reserves)."
                : "Pass threshold is 50% — no profile rewards on failure."}
            </p>
            {passed ? (
              <Card className="p-4 border-primary/30 bg-primary/5 text-left research-fade-in">
                <p className="text-xs font-mono-data text-muted-foreground mb-2">REWARDS_APPLIED</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Subject XP (global):</span>{" "}
                    <span className="text-primary font-mono-data">+{xpToSubject}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subject level:</span>{" "}
                    <span className="font-mono-data">{subjectProfile.level}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lab XP (research track):</span>{" "}
                    <span className="font-mono-data text-primary">+{Math.max(10, Math.round(activeNode.xpReward * (pct / 100)))}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">INT reserve:</span>{" "}
                    <span className="font-mono-data">+{attr.INT ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PER reserve:</span>{" "}
                    <span className="font-mono-data">+{attr.PER ?? 0}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                  Hidden attribute points accumulate in reserves and apply on level-up (same as quests).
                </p>
              </Card>
            ) : null}
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
