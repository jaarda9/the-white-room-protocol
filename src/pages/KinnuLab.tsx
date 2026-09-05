import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SoloLevelingHeader } from "@/components/SoloLevelingHeader";
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
import { ArrowLeft, CheckCircle2, ChevronRight, Lock, Sparkles, Trophy, Brain } from "lucide-react";
import { systemSound } from "@/lib/system-sound";

type View = "domains" | "map" | "lesson" | "quiz" | "results";
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
];

export default function KinnuLab() {
  const navigate = useNavigate();
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

  const domains = useMemo(() => Object.values(knowledgeContentMap), []);
  const progress = useMemo(
    () => (selectedDomain ? getProgress(selectedDomain.id) : {}),
    [selectedDomain, view]
  );

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

  const getNodeStatus = (node: LessonNode): NodeStatus => {
    if (progress[node.id]) return "completed";
    const unlocked = node.prerequisites.every((pr) => progress[pr]);
    return unlocked ? "available" : "locked";
  };

  const openDomain = (domain: KnowledgeDomainContent): void => {
    systemSound.playClick();
    setSelectedDomain(domain);
    setActiveNodeId(null);
    setView("map");
  };

  const openNode = (node: LessonNode): void => {
    if (getNodeStatus(node) === "locked") return;
    systemSound.playClick();
    setActiveNodeId(node.id);
    setLessonStep(0);
    setView("lesson");
  };

  const startQuiz = (): void => {
    systemSound.playClick();
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
    systemSound.playClick();
    setSelectedAnswer(idx);
    setAnswered(true);
    if (idx === activeNode.lesson.quiz[quizIndex].correctIndex) {
      setCorrectCount((v) => v + 1);
    }
  };

  const handleQuizNext = (): void => {
    if (!activeNode) return;
    systemSound.playClick();
    const total = activeNode.lesson.quiz.length;
    if (quizIndex + 1 >= total) {
      systemSound.playLevelUp();
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
      setView("results");
      return;
    }
    setQuizIndex((v) => v + 1);
    setSelectedAnswer(null);
    setAnswered(false);
  };

  const goBack = (): void => {
    systemSound.playClick();
    if (view === "results") {
      setView("map");
      return;
    }
    if (view === "quiz") {
      setView("lesson");
      return;
    }
    if (view === "lesson") {
      setView("map");
      return;
    }
    if (view === "map") {
      setSelectedDomain(null);
      setView("domains");
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">


      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN ]</span>
          </button>
        </div>

        {/* DOMAINS VIEW */}
        {view === "domains" && (
          <div className="space-y-6">
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  KNOWLEDGE & LOGIC FORGE
                </h1>
              </div>
              <p className="text-xs font-mono text-white/80 mt-1">
                Cognitive mastery skill trees and spaced retrieval research nodes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  onClick={() => openDomain(domain)}
                  className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-6 cursor-pointer hover:border-white/90 hover:bg-[#0a1b2e] transition-all flex items-center justify-between group shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
                >
                  <div>
                    <h3 className="font-mono font-bold text-base text-white group-hover:text-[#9fd3ff] transition-colors">
                      {domain.name}
                    </h3>
                    <p className="text-xs font-mono text-gray-300 mt-1">
                      {domain.topics.length} Tactical Topics Available
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#9fd3ff] group-hover:translate-x-1 transition-transform" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAP VIEW */}
        {view === "map" && selectedDomain && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 space-y-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <div className="text-center border-b border-white/20 pb-4">
              <div className="inline-block px-6 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h2 className="text-lg font-mono font-bold text-white anime-glow-text tracking-[0.15em]">
                  {selectedDomain.name} SKILL TREE
                </h2>
              </div>
              <p className="text-xs font-mono text-gray-300 mt-1">
                Complete connected nodes to ascend through domain mastery.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              {nodes.map((node) => {
                const status = getNodeStatus(node);
                const isLocked = status === "locked";
                return (
                  <div
                    key={node.id}
                    onClick={() => openNode(node)}
                    className={`p-4 border rounded-[2px] transition-all flex items-center justify-between ${
                      status === "completed"
                        ? "border-emerald-400 bg-emerald-950/30 text-emerald-300 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                        : isLocked
                        ? "border-gray-800 bg-[#061424]/40 text-gray-600 opacity-60 cursor-not-allowed"
                        : "border-white/30 bg-[#061424]/75 text-white hover:border-white hover:bg-white/10 cursor-pointer shadow-[0_0_10px_rgba(0,212,255,0.15)]"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{node.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        +{node.xpReward} XP • {node.estimatedMinutes}m Read
                      </div>
                    </div>
                    {status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isLocked ? (
                      <Lock className="w-4 h-4 text-gray-600" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[#9fd3ff] animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LESSON VIEW */}
        {view === "lesson" && activeNode && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 space-y-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <div className="border-b border-white/20 pb-4">
              <h2 className="text-xl font-mono font-bold text-white anime-glow-text">
                {activeNode.title}
              </h2>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Section {lessonStep + 1} of {activeNode.lesson.content.length}
              </p>
            </div>

            <div className="font-mono text-sm leading-relaxed text-gray-200 bg-[#061424] border border-white/30 p-4 rounded-[2px]">
              {activeNode.lesson.content[lessonStep] || activeNode.lesson.keyFacts.join(" ")}
            </div>

            <div className="flex justify-between font-mono text-xs">
              <button
                disabled={lessonStep === 0}
                onClick={() => setLessonStep((s) => Math.max(0, s - 1))}
                className="px-4 py-2 border border-white/30 bg-[#061424]/60 text-gray-300 disabled:opacity-30 hover:border-white"
              >
                PREVIOUS
              </button>
              {lessonStep < activeNode.lesson.content.length - 1 ? (
                <button
                  onClick={() => setLessonStep((s) => s + 1)}
                  className="px-4 py-2 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-bold transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)] hover:border-white"
                >
                  NEXT SECTION
                </button>
              ) : (
                <button
                  onClick={startQuiz}
                  className="px-4 py-2 border border-emerald-400/80 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                >
                  INITIATE QUIZ
                </button>
              )}
            </div>
          </div>
        )}

        {/* QUIZ VIEW */}
        {view === "quiz" && activeNode && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 space-y-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <div className="border-b border-white/20 pb-4 text-center">
              <h2 className="text-lg font-mono font-bold text-white anime-glow-text">
                TRIAL QUESTION {quizIndex + 1} / {activeNode.lesson.quiz.length}
              </h2>
              <p className="font-mono text-sm text-gray-200 mt-3">
                {activeNode.lesson.quiz[quizIndex].question}
              </p>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              {activeNode.lesson.quiz[quizIndex].options.map((opt, i) => (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => handleSelectAnswer(i)}
                  className={`w-full p-3 border text-left transition-all rounded-[2px] ${
                    answered
                      ? i === activeNode.lesson.quiz[quizIndex].correctIndex
                        ? 'border-emerald-400 bg-emerald-950/40 text-emerald-300 font-bold'
                        : i === selectedAnswer
                        ? 'border-red-500 bg-red-950/40 text-red-400 font-bold'
                        : 'border-white/10 text-gray-500'
                      : 'border-white/30 bg-[#061424]/75 hover:border-white hover:bg-white/10 text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {answered && (
              <div className="pt-4 border-t border-white/20 flex justify-end">
                <button
                  onClick={handleQuizNext}
                  className="px-6 py-2 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-xs hover:border-white shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                >
                  CONTINUE
                </button>
              </div>
            )}
          </div>
        )}

        {/* RESULTS VIEW */}
        {view === "results" && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-8 text-center space-y-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <h2 className="text-2xl font-mono font-bold text-white anime-glow-text">
              [ NODE CLEARED ]
            </h2>
            <div className="font-mono text-emerald-400 font-bold text-base anime-glow-text">
              +{finishedOutcome?.xpAwarded || 100} EXP REWARDED
            </div>
            <button
              onClick={() => setView("map")}
              className="w-full py-3.5 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-xs hover:border-white shadow-[0_0_15px_rgba(0,212,255,0.2)]"
            >
              CONFIRM & RETURN TO TREE
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
