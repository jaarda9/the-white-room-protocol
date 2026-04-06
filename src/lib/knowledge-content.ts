/**
 * Hardcoded knowledge content organized by domain > topic > lessons + quizzes.
 * The AI layer just selects the right section — no generation needed.
 */

import { scheduleSyncAfterGeneratedContentSave } from "@/lib/sync-manager";
import { SESSION_SUBJECT_KEY } from "@/lib/subject-auth";
import { addXP, getUserProfile, saveUserProfile } from "@/lib/storage";
import type { Attributes } from "@/lib/types";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string; // e.g. "5 min"
  content: string[]; // paragraphs
  keyFacts: string[];
  quiz: QuizQuestion[];
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  lessons: Lesson[];
}

export interface KnowledgeDomainContent {
  id: string;
  name: string;
  icon: string;
  color: string; // tailwind text color token
  topics: Topic[];
}

// ─── HISTORY DOMAIN ─────────────────────────────────────────────────────────

const historyDomain: KnowledgeDomainContent = {
  id: 'history',
  name: 'History',
  icon: '🏛️',
  color: 'text-amber-500',
  topics: [
    {
      id: 'cold-war',
      name: 'The Cold War',
      description: 'The ideological struggle between the US and USSR that shaped the modern world (1947–1991).',
      icon: '❄️',
      lessons: [
        {
          id: 'cw-origins',
          title: 'Origins of the Cold War',
          duration: '5 min',
          content: [
            'The Cold War emerged from the ashes of World War II. Although the United States and the Soviet Union had fought as allies against Nazi Germany, their alliance was one of convenience rather than shared values.',
            'The US championed capitalism and liberal democracy, while the USSR promoted communism and single-party rule. These ideological differences had been simmering since the Russian Revolution of 1917.',
            'At the Yalta Conference (February 1945) and the Potsdam Conference (July 1945), tensions surfaced over the future of Eastern Europe. Stalin wanted a buffer zone of friendly states, while Truman pushed for free elections.',
            'In 1947, the Truman Doctrine pledged US support for countries resisting communist influence, and the Marshall Plan offered $13 billion in economic aid to rebuild Western Europe — both designed to contain Soviet expansion.',
          ],
          keyFacts: [
            'The term "Cold War" was popularized by journalist Walter Lippmann in 1947.',
            'The Marshall Plan provided $13 billion (≈$150 billion today) to rebuild Europe.',
            'The Iron Curtain speech by Churchill (March 1946) marked the symbolic start.',
            'The Truman Doctrine (1947) established the US policy of containment.',
          ],
          quiz: [
            {
              question: 'What conference in 1945 revealed major US-USSR tensions over Eastern Europe?',
              options: ['Tehran Conference', 'Yalta Conference', 'Paris Peace Conference', 'Bretton Woods'],
              correctIndex: 1,
              explanation: 'The Yalta Conference (Feb 1945) saw disagreements between Stalin and Roosevelt/Churchill over the political future of liberated European nations.',
            },
            {
              question: 'How much aid did the Marshall Plan provide to Europe?',
              options: ['$3 billion', '$8 billion', '$13 billion', '$20 billion'],
              correctIndex: 2,
              explanation: 'The Marshall Plan (1948-1952) provided approximately $13 billion in economic assistance to help rebuild Western European economies.',
            },
            {
              question: 'What US policy aimed to prevent the spread of communism?',
              options: ['Détente', 'Containment', 'Isolationism', 'Appeasement'],
              correctIndex: 1,
              explanation: 'Containment was the cornerstone US strategy, first articulated by diplomat George Kennan and formalized through the Truman Doctrine.',
            },
          ],
        },
        {
          id: 'cw-berlin',
          title: 'The Berlin Crisis & Wall',
          duration: '5 min',
          content: [
            'Berlin became the most dangerous flashpoint of the Cold War. Although located deep inside Soviet-controlled East Germany, the city was divided into four occupation zones (US, UK, French, Soviet).',
            'In June 1948, Stalin blockaded all road, rail, and canal access to West Berlin, attempting to force the Western Allies out. The US and UK responded with the Berlin Airlift, flying in over 2.3 million tons of supplies over 11 months.',
            'The blockade failed, and in 1949 Germany formally split into West Germany (FRG) and East Germany (GDR). Berlin remained divided, becoming a symbol of the broader East-West divide.',
            'On August 13, 1961, East Germany erected the Berlin Wall almost overnight, sealing off West Berlin. The wall stood for 28 years, becoming the most potent symbol of the Iron Curtain. Hundreds died attempting to cross it.',
          ],
          keyFacts: [
            'The Berlin Airlift lasted 11 months (June 1948 – May 1949).',
            'Over 278,000 flights delivered 2.3 million tons of cargo during the airlift.',
            'The Berlin Wall was erected on August 13, 1961.',
            'At least 140 people died trying to cross the Berlin Wall.',
          ],
          quiz: [
            {
              question: 'What was the Western response to the Soviet blockade of Berlin?',
              options: ['Military invasion', 'Berlin Airlift', 'Nuclear threat', 'Diplomatic withdrawal'],
              correctIndex: 1,
              explanation: 'The Berlin Airlift (1948-49) was a massive logistical operation that supplied West Berlin entirely by air for nearly a year.',
            },
            {
              question: 'When was the Berlin Wall erected?',
              options: ['1949', '1955', '1961', '1968'],
              correctIndex: 2,
              explanation: 'The Berlin Wall was built on August 13, 1961, to stop the mass exodus of East Germans to the West.',
            },
          ],
        },
        {
          id: 'cw-cuban-missile',
          title: 'The Cuban Missile Crisis',
          duration: '5 min',
          content: [
            'In October 1962, the world came closer to nuclear war than at any other point in history. US reconnaissance aircraft discovered Soviet nuclear missile sites under construction in Cuba, just 90 miles from Florida.',
            'President Kennedy imposed a naval blockade (termed a "quarantine") around Cuba and demanded the removal of all missiles. For 13 tense days, the US and USSR stood on the brink of mutual annihilation.',
            'Behind the scenes, intense negotiations took place. Attorney General Robert Kennedy met secretly with Soviet Ambassador Dobrynin. The crisis ended when Khrushchev agreed to remove the missiles in exchange for a US promise not to invade Cuba and a secret agreement to remove US missiles from Turkey.',
            'The crisis had lasting consequences: a direct hotline was established between Washington and Moscow, and both sides pursued the Partial Nuclear Test Ban Treaty of 1963, marking the first steps toward arms control.',
          ],
          keyFacts: [
            'The crisis lasted 13 days (October 16-28, 1962).',
            'Soviet missiles in Cuba could have reached most major US cities.',
            'The Moscow-Washington hotline was established in 1963 as a direct result.',
            'The US secretly agreed to remove Jupiter missiles from Turkey.',
          ],
          quiz: [
            {
              question: 'How long did the Cuban Missile Crisis last?',
              options: ['7 days', '13 days', '21 days', '30 days'],
              correctIndex: 1,
              explanation: 'The crisis lasted 13 days, from October 16-28, 1962, making it the most intense period of the Cold War.',
            },
            {
              question: 'What was established as a direct result of the crisis?',
              options: ['NATO expansion', 'Moscow-Washington hotline', 'Berlin Wall', 'Space race'],
              correctIndex: 1,
              explanation: 'The hotline (established 1963) ensured direct communication between the two superpowers to prevent future miscalculations.',
            },
            {
              question: 'What secret concession did the US make?',
              options: ['Recognized Cuba', 'Removed missiles from Turkey', 'Withdrew from NATO', 'Reduced nuclear arsenal by 50%'],
              correctIndex: 1,
              explanation: 'The US secretly agreed to remove Jupiter missiles from Turkey, a concession not publicly revealed for years.',
            },
          ],
        },
        {
          id: 'cw-end',
          title: 'The Fall of the Soviet Union',
          duration: '5 min',
          content: [
            'By the 1980s, the Soviet economy was stagnating under the weight of military spending, central planning inefficiencies, and technological lag. When Mikhail Gorbachev became General Secretary in 1985, he introduced two revolutionary policies: glasnost (openness) and perestroika (restructuring).',
            'Glasnost allowed unprecedented freedom of speech and press, which unleashed pent-up nationalistic and democratic movements across the Soviet republics. Perestroika attempted to modernize the economy by introducing limited market reforms.',
            'In 1989, a wave of revolutions swept Eastern Europe. Poland held free elections, Hungary opened its border with Austria, and on November 9, the Berlin Wall fell. These events, once unthinkable, happened with stunning speed.',
            'On December 25, 1991, Gorbachev resigned as President of the USSR. The Soviet flag was lowered over the Kremlin for the last time, and 15 independent republics emerged. The Cold War was over.',
          ],
          keyFacts: [
            'Gorbachev introduced glasnost (openness) and perestroika (restructuring) in the mid-1980s.',
            'The Berlin Wall fell on November 9, 1989.',
            'The Soviet Union officially dissolved on December 26, 1991.',
            '15 independent republics emerged from the former USSR.',
          ],
          quiz: [
            {
              question: 'What policy introduced freedom of press in the USSR?',
              options: ['Perestroika', 'Glasnost', 'Détente', 'Containment'],
              correctIndex: 1,
              explanation: 'Glasnost (openness) allowed freedom of speech and press, which inadvertently accelerated the USSR\'s dissolution.',
            },
            {
              question: 'When did the Berlin Wall fall?',
              options: ['1987', '1988', '1989', '1991'],
              correctIndex: 2,
              explanation: 'The Berlin Wall fell on November 9, 1989, symbolizing the end of the Iron Curtain across Europe.',
            },
          ],
        },
      ],
    },
    {
      id: 'roman-empire',
      name: 'The Roman Empire',
      description: 'Rise and fall of the greatest empire of the ancient world.',
      icon: '⚔️',
      lessons: [
        {
          id: 're-founding',
          title: 'From Republic to Empire',
          duration: '5 min',
          content: [
            'Rome began as a small city-state on the Italian peninsula, traditionally founded in 753 BC. For centuries it was governed as a republic, with elected officials and a powerful Senate.',
            'The Republic expanded aggressively through military conquest, absorbing the Italian peninsula, then the Mediterranean. But expansion brought internal strains: wealth inequality, slave revolts, and ambitious generals.',
            'Julius Caesar crossed the Rubicon in 49 BC, sparking a civil war. After defeating his rivals, he became dictator — but was assassinated on the Ides of March (March 15, 44 BC) by senators fearing tyranny.',
            'Caesar\'s adopted heir Octavian defeated Mark Antony and Cleopatra at the Battle of Actium (31 BC), and in 27 BC the Senate granted him the title "Augustus" — marking the birth of the Roman Empire.',
          ],
          keyFacts: [
            'Rome was traditionally founded in 753 BC.',
            'Julius Caesar was assassinated on March 15, 44 BC (the Ides of March).',
            'Octavian became Augustus, the first Roman Emperor, in 27 BC.',
            'The Battle of Actium (31 BC) ended the Roman Republic era.',
          ],
          quiz: [
            {
              question: 'Who was the first Roman Emperor?',
              options: ['Julius Caesar', 'Augustus', 'Nero', 'Tiberius'],
              correctIndex: 1,
              explanation: 'Augustus (formerly Octavian) became the first Emperor in 27 BC when the Senate granted him extraordinary powers.',
            },
            {
              question: 'When was Julius Caesar assassinated?',
              options: ['49 BC', '44 BC', '31 BC', '27 BC'],
              correctIndex: 1,
              explanation: 'Caesar was assassinated on March 15, 44 BC — the famous "Ides of March."',
            },
          ],
        },
        {
          id: 're-fall',
          title: 'The Fall of Rome',
          duration: '5 min',
          content: [
            'The Western Roman Empire\'s decline was a gradual process spanning centuries. Historians debate the exact causes, but several key factors converged.',
            'Military overextension made Rome\'s vast borders impossible to defend. The empire increasingly relied on Germanic mercenaries (foederati) who had divided loyalties.',
            'Economic troubles — inflation, heavy taxation, and trade disruption — weakened the empire\'s foundation. The once-mighty infrastructure crumbled without funds for maintenance.',
            'In 476 AD, the Germanic chieftain Odoacer deposed the last Western Roman Emperor, Romulus Augustulus. The Eastern Empire (Byzantine) continued for nearly another thousand years until Constantinople fell in 1453.',
          ],
          keyFacts: [
            'The Western Roman Empire fell in 476 AD.',
            'The last Western Emperor was Romulus Augustulus.',
            'The Eastern (Byzantine) Empire survived until 1453 AD.',
            'Edward Gibbon\'s "Decline and Fall" (1776) identified over 200 contributing factors.',
          ],
          quiz: [
            {
              question: 'When did the Western Roman Empire officially fall?',
              options: ['395 AD', '410 AD', '476 AD', '1453 AD'],
              correctIndex: 2,
              explanation: 'The traditional date is 476 AD when Odoacer deposed Emperor Romulus Augustulus.',
            },
          ],
        },
      ],
    },
    {
      id: 'ww2',
      name: 'World War II',
      description: 'The deadliest conflict in human history (1939–1945).',
      icon: '💥',
      lessons: [
        {
          id: 'ww2-causes',
          title: 'Causes of World War II',
          duration: '5 min',
          content: [
            'World War II\'s roots lie in the unresolved aftermath of World War I. The Treaty of Versailles (1919) imposed harsh reparations on Germany, creating economic hardship and national humiliation.',
            'The Great Depression (1929) devastated global economies, creating fertile ground for extremist ideologies. In Germany, Adolf Hitler and the Nazi Party rose to power in 1933, promising national revival.',
            'Hitler\'s aggressive foreign policy — remilitarizing the Rhineland (1936), annexing Austria (Anschluss, 1938), and seizing Czechoslovakia — was met with appeasement by Britain and France, who hoped to avoid another war.',
            'The final trigger came on September 1, 1939, when Germany invaded Poland. Britain and France declared war two days later. The world was once again engulfed in total war.',
          ],
          keyFacts: [
            'The Treaty of Versailles (1919) imposed massive reparations on Germany.',
            'Hitler became Chancellor of Germany in January 1933.',
            'The Munich Agreement (1938) is considered the peak of appeasement policy.',
            'WWII began on September 1, 1939 with the invasion of Poland.',
          ],
          quiz: [
            {
              question: 'What event directly triggered the start of WWII?',
              options: ['Annexation of Austria', 'Invasion of Poland', 'Munich Agreement', 'Remilitarization of Rhineland'],
              correctIndex: 1,
              explanation: 'Germany\'s invasion of Poland on September 1, 1939 led Britain and France to declare war, officially starting WWII.',
            },
            {
              question: 'What treaty imposed harsh terms on Germany after WWI?',
              options: ['Treaty of Paris', 'Treaty of Versailles', 'Treaty of Ghent', 'Treaty of Westphalia'],
              correctIndex: 1,
              explanation: 'The Treaty of Versailles (1919) forced Germany to accept war guilt, pay reparations, and lose territory.',
            },
          ],
        },
      ],
    },
  ],
};

// ─── SCIENCE DOMAIN ─────────────────────────────────────────────────────────

const scienceDomain: KnowledgeDomainContent = {
  id: 'science',
  name: 'Science',
  icon: '🔬',
  color: 'text-blue-500',
  topics: [
    {
      id: 'quantum-mechanics',
      name: 'Quantum Mechanics',
      description: 'The strange rules governing the subatomic world.',
      icon: '⚛️',
      lessons: [
        {
          id: 'qm-intro',
          title: 'What is Quantum Mechanics?',
          duration: '5 min',
          content: [
            'Quantum mechanics is the branch of physics that describes nature at the smallest scales — atoms, electrons, photons, and other subatomic particles. At this scale, the rules of classical physics break down entirely.',
            'In 1900, Max Planck discovered that energy is not continuous but comes in discrete packets called "quanta." This revolutionary insight earned him the Nobel Prize and launched the quantum revolution.',
            'Unlike classical objects, quantum particles exhibit wave-particle duality — they behave as both particles and waves depending on how they\'re observed. This was demonstrated in the famous double-slit experiment.',
            'The Heisenberg Uncertainty Principle (1927) states that you cannot simultaneously know both the exact position and exact momentum of a particle. This isn\'t a limitation of measurement — it\'s a fundamental property of nature.',
          ],
          keyFacts: [
            'Max Planck introduced the concept of energy quanta in 1900.',
            'Wave-particle duality means particles can behave as waves and vice versa.',
            'The Uncertainty Principle limits what can be simultaneously known about a particle.',
            'Quantum mechanics accurately predicts phenomena that classical physics cannot.',
          ],
          quiz: [
            {
              question: 'Who introduced the concept of energy quanta?',
              options: ['Einstein', 'Bohr', 'Planck', 'Heisenberg'],
              correctIndex: 2,
              explanation: 'Max Planck introduced the quantum hypothesis in 1900, proposing that energy is emitted in discrete packets.',
            },
            {
              question: 'What does wave-particle duality mean?',
              options: [
                'Waves are made of particles',
                'Particles can behave as both waves and particles',
                'Only light shows wave behavior',
                'Particles always travel in waves',
              ],
              correctIndex: 1,
              explanation: 'Wave-particle duality means quantum entities exhibit both wave-like and particle-like properties depending on the experiment.',
            },
          ],
        },
      ],
    },
  ],
};

// ─── MASTER CONTENT MAP ─────────────────────────────────────────────────────

export const knowledgeContentMap: Record<string, KnowledgeDomainContent> = {
  history: historyDomain,
  science: scienceDomain,
};

export function getDomain(domainId: string): KnowledgeDomainContent | undefined {
  return knowledgeContentMap[domainId];
}

export function getTopic(domainId: string, topicId: string): Topic | undefined {
  return knowledgeContentMap[domainId]?.topics.find(t => t.id === topicId);
}

export function getLesson(domainId: string, topicId: string, lessonId: string): Lesson | undefined {
  return getTopic(domainId, topicId)?.lessons.find(l => l.id === lessonId);
}

function getActiveSubjectId(): string | null {
  const sessionId = localStorage.getItem(SESSION_SUBJECT_KEY);
  if (sessionId) return sessionId;

  const rawProfile = localStorage.getItem("whiteroom_user_profile");
  if (!rawProfile) return null;
  try {
    const parsed = JSON.parse(rawProfile) as { id?: string };
    return typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

function progressKey(domainId: string): string {
  const subjectId = getActiveSubjectId();
  return subjectId
    ? `knowledge-progress:${subjectId}:${domainId}`
    : `knowledge-progress:${domainId}`;
}

function legacyProgressKey(domainId: string): string {
  return `knowledge-progress-${domainId}`;
}

function quizScoreKey(lessonId: string): string {
  const subjectId = getActiveSubjectId();
  return subjectId
    ? `quiz-score:${subjectId}:${lessonId}`
    : `quiz-score:${lessonId}`;
}

function legacyQuizScoreKey(lessonId: string): string {
  return `quiz-score-${lessonId}`;
}

function researchMetaKey(): string {
  const subjectId = getActiveSubjectId();
  return subjectId ? `research-progress-meta:${subjectId}` : "research-progress-meta";
}

export interface ResearchProgressMeta {
  xp: number;
  streak: number;
  lastActiveDate: string;
  achievements: string[];
  startDate: string;
}

export interface ResearchAchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (input: { completedCount: number; averageScore: number; streak: number; xp: number; bonusCompleted: boolean }) => boolean;
}

const DEFAULT_RESEARCH_META: ResearchProgressMeta = {
  xp: 0,
  streak: 0,
  lastActiveDate: "",
  achievements: [],
  startDate: new Date().toISOString(),
};

export const RESEARCH_ACHIEVEMENTS: ResearchAchievementDef[] = [
  {
    id: "first-node",
    title: "First Discovery",
    description: "Complete your first lesson node.",
    icon: "🚀",
    condition: ({ completedCount }) => completedCount >= 1,
  },
  {
    id: "three-nodes",
    title: "Momentum",
    description: "Complete 3 lesson nodes.",
    icon: "🔥",
    condition: ({ completedCount }) => completedCount >= 3,
  },
  {
    id: "scholar",
    title: "Scholar",
    description: "Reach an average quiz score of 80%+.",
    icon: "📚",
    condition: ({ averageScore }) => averageScore >= 80,
  },
  {
    id: "streak-3",
    title: "Consistency",
    description: "Maintain a 3-day streak.",
    icon: "⚡",
    condition: ({ streak }) => streak >= 3,
  },
  {
    id: "xp-500",
    title: "Research Veteran",
    description: "Earn 500 research XP.",
    icon: "🏆",
    condition: ({ xp }) => xp >= 500,
  },
  {
    id: "bonus-explorer",
    title: "Explorer",
    description: "Complete a bonus node.",
    icon: "🗺️",
    condition: ({ bonusCompleted }) => bonusCompleted,
  },
];

/** Get user progress from localStorage */
export function getProgress(domainId: string): Record<string, boolean> {
  const key = progressKey(domainId);
  const legacyKey = legacyProgressKey(domainId);
  try {
    const scoped = localStorage.getItem(key);
    if (scoped) {
      return JSON.parse(scoped);
    }

    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      // One-time forward migration from old global key.
      localStorage.setItem(key, legacy);
      localStorage.removeItem(legacyKey);
      scheduleSyncAfterGeneratedContentSave();
      return JSON.parse(legacy);
    }

    return {};
  } catch {
    return {};
  }
}

/** Mark a lesson as completed */
export function markLessonComplete(domainId: string, lessonId: string) {
  const key = progressKey(domainId);
  const progress = getProgress(domainId);
  progress[lessonId] = true;
  localStorage.setItem(key, JSON.stringify(progress));
  scheduleSyncAfterGeneratedContentSave();
}

/** Get quiz scores from localStorage */
export function getQuizScore(lessonId: string): { score: number; total: number } | null {
  const key = quizScoreKey(lessonId);
  const legacyKey = legacyQuizScoreKey(lessonId);
  try {
    const scoped = localStorage.getItem(key);
    if (scoped) {
      return JSON.parse(scoped);
    }

    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      // One-time forward migration from old global key.
      localStorage.setItem(key, legacy);
      localStorage.removeItem(legacyKey);
      scheduleSyncAfterGeneratedContentSave();
      return JSON.parse(legacy);
    }

    return null;
  } catch {
    return null;
  }
}

export function saveQuizScore(lessonId: string, score: number, total: number) {
  localStorage.setItem(quizScoreKey(lessonId), JSON.stringify({ score, total }));
  scheduleSyncAfterGeneratedContentSave();
}

export function getResearchProgressMeta(): ResearchProgressMeta {
  const key = researchMetaKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_RESEARCH_META };
    const parsed = JSON.parse(raw) as Partial<ResearchProgressMeta>;
    return {
      xp: Number.isFinite(parsed.xp) ? Math.max(0, Number(parsed.xp)) : 0,
      streak: Number.isFinite(parsed.streak) ? Math.max(0, Number(parsed.streak)) : 0,
      lastActiveDate: typeof parsed.lastActiveDate === "string" ? parsed.lastActiveDate : "",
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements.filter((a): a is string => typeof a === "string") : [],
      startDate: typeof parsed.startDate === "string" && parsed.startDate.length > 0 ? parsed.startDate : new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT_RESEARCH_META };
  }
}

function saveResearchProgressMeta(meta: ResearchProgressMeta): void {
  localStorage.setItem(researchMetaKey(), JSON.stringify(meta));
  scheduleSyncAfterGeneratedContentSave();
}

function getAverageQuizScoreForDomain(domainId: string): number {
  const domain = getDomain(domainId);
  if (!domain) return 0;
  const scores = domain.topics
    .flatMap((topic) => topic.lessons)
    .map((lesson) => getQuizScore(lesson.id))
    .filter((s): s is { score: number; total: number } => !!s)
    .map((s) => (s.total > 0 ? Math.round((s.score / s.total) * 100) : 0));
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function hasCompletedBonusNode(domainId: string): boolean {
  const domain = getDomain(domainId);
  if (!domain) return false;
  const progress = getProgress(domainId);
  return domain.topics.some((topic) =>
    topic.lessons.some((lesson) => lesson.id.toLowerCase().includes("bonus") && progress[lesson.id])
  );
}

export function completeResearchLessonNode(input: {
  domainId: string;
  lessonId: string;
  score: number;
  total: number;
  xpReward?: number;
}): {
  passed: boolean;
  unlockedAchievements: string[];
  meta: ResearchProgressMeta;
  xpAwarded: number;
  attributeRewards: Partial<Attributes>;
} {
  const { domainId, lessonId, score, total, xpReward = 100 } = input;
  const safeTotal = Math.max(1, total);
  const percent = Math.round((Math.max(0, score) / safeTotal) * 100);
  const passed = percent >= 50;
  const previousProgress = getProgress(domainId);
  const wasAlreadyCompleted = !!previousProgress[lessonId];
  let xpAwarded = 0;
  const attributeRewards: Partial<Attributes> = {};

  saveQuizScore(lessonId, Math.max(0, score), safeTotal);

  let meta = getResearchProgressMeta();

  if (passed && !wasAlreadyCompleted) {
    markLessonComplete(domainId, lessonId);
    const today = new Date().toDateString();
    if (meta.lastActiveDate !== today) {
      const lastDate = meta.lastActiveDate ? new Date(meta.lastActiveDate) : null;
      const diffDays = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : 2;
      meta.streak = diffDays <= 1 ? meta.streak + 1 : 1;
      meta.lastActiveDate = today;
    }
    xpAwarded = Math.max(10, Math.round(xpReward * (percent / 100)));
    meta.xp += xpAwarded;

    // Push rewards into the main user profile so dashboard/profile stay in sync.
    const profile = getUserProfile();
    let updatedProfile = addXP(profile, xpAwarded);
    const newAccumulated = { ...updatedProfile.accumulatedPoints };
    const intGain = percent >= 80 ? 2 : 1;
    const perGain = percent === 100 ? 1 : 0;
    newAccumulated.INT += intGain;
    if (perGain > 0) {
      newAccumulated.PER += perGain;
    }
    attributeRewards.INT = intGain;
    if (perGain > 0) {
      attributeRewards.PER = perGain;
    }
    updatedProfile = { ...updatedProfile, accumulatedPoints: newAccumulated };
    saveUserProfile(updatedProfile);
  }

  const latestProgress = getProgress(domainId);
  const completedCount = Object.keys(latestProgress).filter((id) => latestProgress[id]).length;
  const averageScore = getAverageQuizScoreForDomain(domainId);
  const bonusCompleted = hasCompletedBonusNode(domainId);
  const unlockedAchievements: string[] = [];

  for (const achievement of RESEARCH_ACHIEVEMENTS) {
    if (meta.achievements.includes(achievement.id)) continue;
    const ok = achievement.condition({
      completedCount,
      averageScore,
      streak: meta.streak,
      xp: meta.xp,
      bonusCompleted,
    });
    if (ok) {
      meta.achievements.push(achievement.id);
      unlockedAchievements.push(achievement.id);
    }
  }

  saveResearchProgressMeta(meta);
  return { passed, unlockedAchievements, meta, xpAwarded, attributeRewards };
}
