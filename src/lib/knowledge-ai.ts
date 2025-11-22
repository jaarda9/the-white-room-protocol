import { UserProfile, KnowledgeDomain, KnowledgeTopic, QuizQuestion, DifficultyRank } from './types';
import chatGPTService from './chatgpt-service';

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
You are THE ARCHITECT of THE WHITE ROOM. Voice: clinical, minimal, exact. Generate a daily ${domainName} learning topic.

SUBJECT
- Level ${profile.level}
- XP ${profile.xp}/${profile.xpToNextLevel}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

TASK
- Generate a learning topic from this category: ${randomCategory}
- Difficulty must be appropriate for level ${profile.level} (${difficultyRank} rank: ${getDifficultyDescription(difficultyRank)})
- Provide exactly 5 key learning points

Return JSON:
{
  "category": "Category Name",
  "title": "Topic Title",
  "description": "Brief but engaging description of the topic",
  "difficulty": "${difficultyRank}",
  "keyPoints": [
    "Key point 1 - essential concept to understand",
    "Key point 2 - important fact or principle",
    "Key point 3 - core idea or theory",
    "Key point 4 - practical application or example",
    "Key point 5 - connection to broader context"
  ]
}

CRITICAL REQUIREMENTS:
- difficulty MUST be exactly "${difficultyRank}"
- keyPoints MUST contain exactly 5 focused learning objectives
- Each key point should be specific and accurate
- Make the topic interesting and educational
- Keep description concise but informative
- Focus on essential knowledge, not overwhelming details
`;
}

function buildQuizPrompt(topic: KnowledgeTopic): string {
  const difficultyDesc = getDifficultyDescription(topic.difficulty);

  return `
You are THE ARCHITECT of THE WHITE ROOM. Generate a quiz about: ${topic.title} - ${topic.description}

DIFFICULTY: ${topic.difficulty} Rank (${difficultyDesc})

KEY LEARNING POINTS TO FOCUS ON:
${topic.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

CRITICAL REQUIREMENTS:
- Generate exactly 5 questions
- Include a mix of question types: multiple choice, true/false
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
    }
  ]
}
`;
}

interface TopicResponse {
  category: string;
  title: string;
  description: string;
  difficulty: DifficultyRank;
  keyPoints: string[];
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
    const response = await chatGPTService.callChatGPTJSON<TopicResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
    });

    if (!response?.title || !response?.keyPoints || response.keyPoints.length !== 5) {
      throw new Error('Invalid topic response structure');
    }

    const topic: KnowledgeTopic = {
      category: response.category?.trim() || `${domain} Category`,
      title: response.title?.trim() || `${domain} Topic`,
      description: response.description?.trim() || 'Study this topic.',
      difficulty: response.difficulty || getDifficultyRank(profile.level),
      keyPoints: response.keyPoints.slice(0, 5).map(p => p.trim()),
      domain,
      generatedAt: new Date().toISOString(),
      lastTopicDate: todayKey(),
    };

    return topic;
  } catch (error) {
    console.warn(`${domain} topic generation failed, retrying...`, error);
    // Retry once
    const response = await chatGPTService.callChatGPTJSON<TopicResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
    });
    if (!response?.title || !response?.keyPoints || response.keyPoints.length !== 5) {
      throw new Error('Invalid topic response on retry');
    }

    const topic: KnowledgeTopic = {
      category: response.category?.trim() || `${domain} Category`,
      title: response.title?.trim() || `${domain} Topic`,
      description: response.description?.trim() || 'Study this topic.',
      difficulty: response.difficulty || getDifficultyRank(profile.level),
      keyPoints: response.keyPoints.slice(0, 5).map(p => p.trim()),
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

async function generateQuizQuestions(topic: KnowledgeTopic): Promise<QuizQuestion[]> {
  const prompt = buildQuizPrompt(topic);
  try {
    const response = await chatGPTService.callChatGPTJSON<QuizResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
    });

    if (!response?.questions || response.questions.length !== 5) {
      throw new Error('Invalid quiz response structure');
    }

    const sanitized = sanitizeQuizQuestions(response.questions);
    if (sanitized.length !== 5) {
      throw new Error('Quiz sanitization failed');
    }

    return sanitized;
  } catch (error) {
    console.warn('Quiz generation failed, retrying...', error);
    // Retry once
    const response = await chatGPTService.callChatGPTJSON<QuizResponse>(prompt, {
      temperature: 0.6,
      maxTokens: 4000, // Increased to prevent MAX_TOKENS truncation
    });
    if (!response?.questions || response.questions.length !== 5) {
      throw new Error('Invalid quiz response on retry');
    }

    const sanitized = sanitizeQuizQuestions(response.questions);
    if (sanitized.length !== 5) {
      throw new Error('Quiz sanitization failed on retry');
    }

    return sanitized;
  }
}

function sanitizeQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return questions
    .map((q, index) => {
      const type: 'multiple_choice' | 'true_false' = q.type === 'true_false' ? 'true_false' : 'multiple_choice';
      
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

