import { UserProfile, KnowledgeDomain, KnowledgeTopic, QuizQuestion, DifficultyRank } from './types';
import aiGatewayClient from './ai-gateway-client';
import { scheduleSyncAfterGeneratedContentSave } from './sync-manager';

const KNOWLEDGE_CACHE_PREFIX = 'wrp_knowledge_';

interface TopicCache {
  date: string;
  topic: KnowledgeTopic;
}

interface QuizCache {
  date: string;
  quiz: QuizQuestion[];
}

const topicRequests: Record<KnowledgeDomain, Promise<KnowledgeTopic> | null> = {
  science: null,
  history: null,
  geography: null,
  economics: null,
  politics: null,
};

const quizRequests: Record<KnowledgeDomain, Promise<QuizQuestion[]> | null> = {
  science: null,
  history: null,
  geography: null,
  economics: null,
  politics: null,
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const loadTopicCache = (domain: KnowledgeDomain): TopicCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${KNOWLEDGE_CACHE_PREFIX}topic_${domain}`);
    if (!raw) return null;
    const cached = JSON.parse(raw) as TopicCache;
    if (cached.date !== todayKey()) {
      localStorage.removeItem(`${KNOWLEDGE_CACHE_PREFIX}topic_${domain}`);
      return null;
    }
    // Old-shape cache from before researchPrompt replaced keyPoints (the free-answers-before-
    // the-quiz bug) — treat as a miss rather than crash or silently keep the old answer-key
    // behavior for whatever's left in cache today.
    if (typeof cached.topic?.researchPrompt !== 'string') {
      localStorage.removeItem(`${KNOWLEDGE_CACHE_PREFIX}topic_${domain}`);
      return null;
    }
    return cached;
  } catch (error) {
    console.warn('Failed to parse topic cache', domain, error);
    return null;
  }
};

const saveTopicCache = (domain: KnowledgeDomain, topic: KnowledgeTopic): void => {
  if (typeof window === 'undefined') return;
  try {
    const payload: TopicCache = {
      date: todayKey(),
      topic,
    };
    localStorage.setItem(`${KNOWLEDGE_CACHE_PREFIX}topic_${domain}`, JSON.stringify(payload));
    scheduleSyncAfterGeneratedContentSave();
  } catch (error) {
    console.warn('Failed to save topic cache', domain, error);
  }
};

const loadQuizCache = (domain: KnowledgeDomain): QuizCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${KNOWLEDGE_CACHE_PREFIX}quiz_${domain}`);
    if (!raw) return null;
    const cached = JSON.parse(raw) as QuizCache;
    if (cached.date !== todayKey()) {
      localStorage.removeItem(`${KNOWLEDGE_CACHE_PREFIX}quiz_${domain}`);
      return null;
    }
    return cached;
  } catch (error) {
    console.warn('Failed to parse quiz cache', domain, error);
    return null;
  }
};

const saveQuizCache = (domain: KnowledgeDomain, quiz: QuizQuestion[]): void => {
  if (typeof window === 'undefined') return;
  try {
    const payload: QuizCache = {
      date: todayKey(),
      quiz,
    };
    localStorage.setItem(`${KNOWLEDGE_CACHE_PREFIX}quiz_${domain}`, JSON.stringify(payload));
    scheduleSyncAfterGeneratedContentSave();
  } catch (error) {
    console.warn('Failed to save quiz cache', domain, error);
  }
};

const formatAttributes = (attrs: Partial<import('./types').Attributes>) =>
  Object.entries(attrs || {})
    .map(([key, value]) => `${key}+${value}`)
    .join(', ') || 'None';

function getDifficultyRank(level: number): DifficultyRank {
  if (level <= 5) return 'E';
  if (level <= 10) return 'D';
  if (level <= 20) return 'C';
  if (level <= 35) return 'B';
  if (level <= 50) return 'A';
  return 'S';
}

function getDifficultyDescription(rank: DifficultyRank): string {
  const descriptions = {
    E: 'Really, really easy - basic concepts and simple facts',
    D: 'A little harder - fundamental understanding required',
    C: 'Moderate - some analytical thinking needed',
    B: 'Challenging - deeper comprehension and connections',
    A: 'Advanced - complex analysis and synthesis',
    S: 'Elite - expert-level understanding and application',
  };
  return descriptions[rank];
}

function getDomainCategories(domain: KnowledgeDomain): string[] {
  const categories: Record<KnowledgeDomain, string[]> = {
    science: [
      'Physics (Mechanics, Thermodynamics, Quantum Physics, Relativity)',
      'Biology (Cell Biology, Genetics, Evolution, Ecology, Anatomy)',
      'Chemistry (Organic, Inorganic, Physical, Biochemistry)',
      'Earth Sciences (Geology, Meteorology, Astronomy, Oceanography)',
      'Technology (Computer Science, Engineering, Innovation, Research Methods)',
    ],
    history: [
      'Ancient Civilizations (Egypt, Greece, Rome, Mesopotamia)',
      'Medieval Period (Feudalism, Crusades, Renaissance)',
      'Modern History (World Wars, Industrial Revolution, Cold War)',
      'Regional History (American, European, Asian, African)',
      'Historical Analysis (Causes, Effects, Patterns, Interpretations)',
    ],
    geography: [
      'Physical Geography (Landforms, Climate, Ecosystems)',
      'Human Geography (Population, Culture, Urbanization)',
      'Political Geography (Borders, Nations, Geopolitics)',
      'Economic Geography (Resources, Trade, Development)',
      'Regional Geography (Continents, Countries, Regions)',
    ],
    economics: [
      'Microeconomics (Supply, Demand, Markets, Competition)',
      'Macroeconomics (GDP, Inflation, Monetary Policy, Fiscal Policy)',
      'International Economics (Trade, Exchange Rates, Globalization)',
      'Economic Systems (Capitalism, Socialism, Mixed Economies)',
      'Economic History (Crises, Development, Economic Thought)',
    ],
    politics: [
      'Political Systems (Democracy, Authoritarianism, Federalism)',
      'Political Theory (Ideologies, Power, Governance)',
      'International Relations (Diplomacy, Alliances, Conflicts)',
      'Public Policy (Legislation, Implementation, Evaluation)',
      'Political History (Revolutions, Movements, Elections)',
    ],
  };
  return categories[domain] || categories.science;
}

function buildTopicPrompt(domain: KnowledgeDomain, profile: UserProfile): string {
  const categories = getDomainCategories(domain);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const difficultyRank = getDifficultyRank(profile.level);
  const domainName = domain.charAt(0).toUpperCase() + domain.slice(1);

  return `
You are THEIA of THE WHITE ROOM. Voice: clinical, minimal, exact. Generate a daily ${domainName} learning topic.

SUBJECT
- Level ${profile.level}
- XP ${profile.xp}/${profile.xpToNextLevel}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

TASK
- Generate a learning topic from this category: ${randomCategory}
- Difficulty must be appropriate for level ${profile.level} (${difficultyRank} rank: ${getDifficultyDescription(difficultyRank)})
- Write ONE short research direction — point the Hunter at what to go find out, do NOT summarize
  the actual facts/answers. This is deliberately not an answer key: the Hunter researches this
  themselves before the quiz tests them on it, so it must never contain the information the quiz
  will ask about.

Return JSON:
{
  "category": "Category Name",
  "title": "Topic Title",
  "description": "Brief but engaging description of the topic",
  "difficulty": "${difficultyRank}",
  "researchPrompt": "One or two sentences telling the Hunter what to go research/find out — a
    direction, not a summary of the facts themselves."
}

CRITICAL REQUIREMENTS:
- difficulty MUST be exactly "${difficultyRank}"
- researchPrompt must NOT contain the actual facts, dates, definitions, or figures the topic
  covers — it should read like an assignment, not a study sheet
- Make the topic interesting and educational
- Keep description concise but informative
`;
}

interface QuizPromptOptions {
  /** Defaults to 5 — the standalone daily Knowledge Lab keeps today's exact shape. Chain-Gate
   * subject quizzes (see chain-gates.ts) ask for more. */
  questionCount?: number;
  /** Chain-Gate subject quizzes only — adds a free_response question type THEIA grades itself
   * (assessFreeResponseAnswer) instead of matching against a fixed option list. */
  includeFreeResponse?: boolean;
  /** Chain-Gate capstone quizzes only — spans every sub-topic covered across the Gate instead
   * of just this one topic. */
  additionalContext?: string;
}

function buildQuizPrompt(topic: KnowledgeTopic, options?: QuizPromptOptions): string {
  const difficultyDesc = getDifficultyDescription(topic.difficulty);
  const questionCount = options?.questionCount ?? 5;
  const freeResponseLine = options?.includeFreeResponse
    ? `\n- Include at least 1 free_response question: no options/correctAnswer to match, instead
  set "gradingRubric" to what a correct answer must cover — THEIA grades the Hunter's typed
  answer against this rubric, not exact string matching.`
    : '';
  const contextBlock = options?.additionalContext ? `\n\nADDITIONAL CONTEXT:\n${options.additionalContext}` : '';

  return `
You are THEIA of THE WHITE ROOM. Generate a quiz about: ${topic.title} - ${topic.description}

DIFFICULTY: ${topic.difficulty} Rank (${difficultyDesc})${contextBlock}

CRITICAL REQUIREMENTS:
- Generate exactly ${questionCount} questions
- Include a mix of question types: multiple_choice, true_false${options?.includeFreeResponse ? ', free_response' : ''}${freeResponseLine}
- Questions MUST be based on authentic knowledge and facts
- For true/false questions, ALWAYS include options: ["True", "False"]
- For multiple choice questions, ALWAYS include exactly 4 options
- Each question MUST include ALL required fields
- Ensure accuracy and respect for the subject matter
- Make questions engaging and educational

Return JSON:
{
  "questions": [
    {
      "question": "Question text here?",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Brief explanation of why this is correct"
    },
    {
      "question": "True or False question here?",
      "type": "true_false",
      "options": ["True", "False"],
      "correctAnswer": "True",
      "explanation": "Brief explanation"
    }${options?.includeFreeResponse ? `,
    {
      "question": "Open-ended question here?",
      "type": "free_response",
      "options": [],
      "correctAnswer": "A model answer",
      "gradingRubric": "What the answer must cover to be considered correct",
      "explanation": "Brief explanation"
    }` : ''}
  ]
}
`;
}

interface TopicResponse {
  category: string;
  title: string;
  description: string;
  difficulty: DifficultyRank;
  researchPrompt: string;
}

interface QuizResponse {
  questions: QuizQuestion[];
}

export async function generateDailyTopic(
  domain: KnowledgeDomain,
  profile: UserProfile
): Promise<KnowledgeTopic> {
  const cacheKey = `${KNOWLEDGE_CACHE_PREFIX}topic_${domain}`;
  const cached = loadTopicCache(domain);
  if (cached && cached.date === todayKey()) {
    return cached.topic;
  }

  if (!topicRequests[domain]) {
    topicRequests[domain] = generateTopic(domain, profile)
      .then(topic => {
        saveTopicCache(domain, topic);
        return topic;
      })
      .finally(() => {
        topicRequests[domain] = null;
      });
  }

  return topicRequests[domain].catch(error => {
    console.warn(`${domain} topic generation failed`, error);
    throw error;
  });
}

async function generateTopic(domain: KnowledgeDomain, profile: UserProfile): Promise<KnowledgeTopic> {
  const prompt = buildTopicPrompt(domain, profile);
  try {
    const response = await aiGatewayClient.completeJson<TopicResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
      providerOverride: 'lab',
    });

    if (!response?.title || !response?.researchPrompt) {
      throw new Error('Invalid topic response structure');
    }

    const topic: KnowledgeTopic = {
      category: response.category?.trim() || `${domain} Category`,
      title: response.title?.trim() || `${domain} Topic`,
      description: response.description?.trim() || 'Study this topic.',
      difficulty: response.difficulty || getDifficultyRank(profile.level),
      researchPrompt: response.researchPrompt.trim(),
      domain,
      generatedAt: new Date().toISOString(),
      lastTopicDate: todayKey(),
    };

    return topic;
  } catch (error) {
    console.warn(`${domain} topic generation failed, retrying...`, error);
    // Retry once
    const response = await aiGatewayClient.completeJson<TopicResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
      providerOverride: 'lab',
    });
    if (!response?.title || !response?.researchPrompt) {
      throw new Error('Invalid topic response on retry');
    }

    const topic: KnowledgeTopic = {
      category: response.category?.trim() || `${domain} Category`,
      title: response.title?.trim() || `${domain} Topic`,
      description: response.description?.trim() || 'Study this topic.',
      difficulty: response.difficulty || getDifficultyRank(profile.level),
      researchPrompt: response.researchPrompt.trim(),
      domain,
      generatedAt: new Date().toISOString(),
      lastTopicDate: todayKey(),
    };

    return topic;
  }
}

export async function generateQuiz(
  domain: KnowledgeDomain,
  topic: KnowledgeTopic
): Promise<QuizQuestion[]> {
  const cacheKey = `${KNOWLEDGE_CACHE_PREFIX}quiz_${domain}`;
  const cached = loadQuizCache(domain);
  if (cached && cached.date === todayKey()) {
    return cached.quiz;
  }

  if (!quizRequests[domain]) {
    // Standalone daily Lab keeps today's exact shape (5 questions, MC/true-false only) — the
    // question-count/free-response extension is scoped to chain-Gate subject quizzes, which
    // call generateQuizQuestions directly (see chain-gates.ts) rather than through this
    // domain-keyed daily cache, since a chain-Gate's topic isn't one of the fixed
    // KnowledgeDomain values and doesn't want day-based caching.
    quizRequests[domain] = generateQuizQuestions(topic)
      .then(quiz => {
        saveQuizCache(domain, quiz);
        return quiz;
      })
      .finally(() => {
        quizRequests[domain] = null;
      });
  }

  return quizRequests[domain].catch(error => {
    console.warn(`${domain} quiz generation failed`, error);
    throw error;
  });
}

export async function generateQuizQuestions(topic: KnowledgeTopic, options?: QuizPromptOptions): Promise<QuizQuestion[]> {
  const questionCount = options?.questionCount ?? 5;
  const prompt = buildQuizPrompt(topic, options);
  try {
    const response = await aiGatewayClient.completeJson<QuizResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
      providerOverride: 'lab',
    });

    if (!response?.questions || response.questions.length !== questionCount) {
      throw new Error('Invalid quiz response structure');
    }

    const sanitized = sanitizeQuizQuestions(response.questions);
    if (sanitized.length !== questionCount) {
      throw new Error('Quiz sanitization failed');
    }

    return sanitized;
  } catch (error) {
    console.warn('Quiz generation failed, retrying...', error);
    // Retry once
    const response = await aiGatewayClient.completeJson<QuizResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
      providerOverride: 'lab',
    });
    if (!response?.questions || response.questions.length !== questionCount) {
      throw new Error('Invalid quiz response on retry');
    }

    const sanitized = sanitizeQuizQuestions(response.questions);
    if (sanitized.length !== questionCount) {
      throw new Error('Quiz sanitization failed on retry');
    }

    return sanitized;
  }
}

function sanitizeQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return questions
    .map((q, index) => {
      const type: 'multiple_choice' | 'true_false' | 'free_response' =
        q.type === 'true_false' ? 'true_false' : q.type === 'free_response' ? 'free_response' : 'multiple_choice';

      // free_response has no fixed option list to validate against — there's nothing to match,
      // THEIA grades the typed answer against gradingRubric instead (see
      // knowledge-ai.ts's assessFreeResponseAnswer).
      if (type === 'free_response') {
        return {
          question: q.question?.trim() || `Question ${index + 1}`,
          type,
          options: [],
          correctAnswer: q.correctAnswer?.trim() || '',
          explanation: q.explanation?.trim() || 'Review the topic material.',
          gradingRubric: q.gradingRubric?.trim() || q.correctAnswer?.trim() || '',
        };
      }

      let options: string[] = [];
      if (type === 'true_false') {
        options = ['True', 'False'];
      } else {
        options = Array.isArray(q.options) && q.options.length >= 2
          ? q.options.slice(0, 4)
          : ['Option A', 'Option B', 'Option C', 'Option D'];
      }

      // Ensure correctAnswer is valid
      let correctAnswer = q.correctAnswer?.trim() || options[0];
      if (!options.includes(correctAnswer)) {
        correctAnswer = options[0];
      }

      return {
        question: q.question?.trim() || `Question ${index + 1}`,
        type,
        options,
        correctAnswer,
        explanation: q.explanation?.trim() || 'Review the topic material.',
      };
    })
    .filter(Boolean);
}

interface RawFreeResponseGrade {
  correct?: boolean;
  feedback?: string;
}

/** Same AI-completeJson-plus-fallback shape as everywhere else in this codebase — never
 * silently marks an answer wrong just because the AI call failed. Fallback: a crude
 * keyword-overlap heuristic against the rubric rather than an outright pass/fail guess. */
export async function assessFreeResponseAnswer(
  question: QuizQuestion,
  userAnswer: string
): Promise<{ correct: boolean; feedback: string }> {
  const prompt = `
Role: Solo Leveling System Analyst THEIA, grading a Hunter's free-response quiz answer.
Question: "${question.question}"
What a correct answer must cover: "${question.gradingRubric || question.correctAnswer}"
Hunter's answer: "${userAnswer}"

Judge whether the Hunter's answer demonstrates the required understanding — it does not need to
match any exact wording, just cover the substance correctly.

Return ONLY valid JSON (no markdown):
{"correct":true,"feedback":"one short sentence in the System's voice"}
`.trim();

  try {
    const res = await aiGatewayClient.completeJson<RawFreeResponseGrade>(prompt, {
      temperature: 0.2,
      maxTokens: 200,
      thinkingBudget: 0,
      providerOverride: 'lab',
    });
    if (!res || typeof res.correct !== 'boolean') {
      throw new Error('Free-response grading response missing required fields');
    }
    return { correct: res.correct, feedback: res.feedback?.trim() || (res.correct ? 'Correct.' : 'Not quite.') };
  } catch {
    const rubric = (question.gradingRubric || question.correctAnswer || '').toLowerCase();
    const rubricWords = rubric.split(/\s+/).filter((w) => w.length > 3);
    const answerLower = userAnswer.toLowerCase();
    const overlap = rubricWords.filter((w) => answerLower.includes(w)).length;
    const correct = rubricWords.length > 0 && overlap / rubricWords.length >= 0.3;
    return {
      correct,
      feedback: 'System could not reach THEIA for a full read — graded on keyword overlap.',
    };
  }
}

