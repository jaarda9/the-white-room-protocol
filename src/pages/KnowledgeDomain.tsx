import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, BookOpen, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { getUserProfile } from '@/lib/storage';
import { UserProfile, type KnowledgeDomain, KnowledgeTopic, QuizQuestion, QuizResult } from '@/lib/types';
import { generateDailyTopic, generateQuiz } from '@/lib/knowledge-ai';
import { getKnowledgeData, saveKnowledgeData, updateKnowledgeProgress } from '@/lib/storage';
import { KnowledgeQuiz } from '@/components/KnowledgeQuiz';
import { KnowledgeResults } from '@/components/KnowledgeResults';
import { updateKnowledgeCompletion } from '@/lib/achievements';
import { useToast } from '@/hooks/use-toast';

const DOMAIN_INFO: Record<KnowledgeDomain, { name: string; icon: any; description: string }> = {
  science: {
    name: 'Science Research',
    icon: '🔬',
    description: 'Physics, Biology, Chemistry, Earth Sciences, Technology',
  },
  history: {
    name: 'History Research',
    icon: '🏛️',
    description: 'Ancient Civilizations, Medieval Period, Modern History',
  },
  geography: {
    name: 'Geography Research',
    icon: '🌍',
    description: 'Physical Geography, Human Geography, Political Geography',
  },
  economics: {
    name: 'Economics Research',
    icon: '💰',
    description: 'Microeconomics, Macroeconomics, International Economics',
  },
  politics: {
    name: 'Politics Research',
    icon: '⚖️',
    description: 'Political Systems, Theory, International Relations',
  },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  E: 'text-green-500',
  D: 'text-blue-500',
  C: 'text-yellow-500',
  B: 'text-orange-500',
  A: 'text-red-500',
  S: 'text-purple-500',
};

export default function KnowledgeDomain() {
  const navigate = useNavigate();
  const { domain } = useParams<{ domain: KnowledgeDomain }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [topic, setTopic] = useState<KnowledgeTopic | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [results, setResults] = useState<QuizResult | null>(null);
  const [topicStatus, setTopicStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [quizStatus, setQuizStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [showQuiz, setShowQuiz] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  const validDomain = domain && ['science', 'history', 'geography', 'economics', 'politics'].includes(domain)
    ? (domain as KnowledgeDomain)
    : null;

  useEffect(() => {
    if (!validDomain) return;
    
    const loadData = async () => {
      const userProfile = getUserProfile();
      setProfile(userProfile);
      
      const knowledgeData = getKnowledgeData(validDomain);
      
      // Check if quiz already completed today
      if (knowledgeData.quizResults) {
        setResults(knowledgeData.quizResults);
        setShowResults(true);
        setTopicStatus('ready');
        return;
      }
      
      // Load or generate topic
      if (knowledgeData.currentTopic) {
        setTopic(knowledgeData.currentTopic);
        setTopicStatus('ready');
        if (knowledgeData.quizData) {
          setQuiz(knowledgeData.quizData);
          setQuizStatus('ready');
        }
      } else {
        setTopicStatus('loading');
        try {
          const newTopic = await generateDailyTopic(validDomain, userProfile);
          setTopic(newTopic);
          knowledgeData.currentTopic = newTopic;
          knowledgeData.lastTopicDate = new Date().toISOString().slice(0, 10);
          saveKnowledgeData(validDomain, knowledgeData);
          setTopicStatus('ready');
        } catch (error) {
          console.error('Failed to load topic:', error);
          setTopicStatus('error');
        }
      }
    };
    
    loadData();
  }, [validDomain]);

  const handleStartQuiz = async () => {
    if (!validDomain || !topic) return;
    
    const knowledgeData = getKnowledgeData(validDomain);
    
    if (knowledgeData.quizData) {
      setQuiz(knowledgeData.quizData);
      setQuizStatus('ready');
      setShowQuiz(true);
      return;
    }
    
    setQuizStatus('loading');
    try {
      const quizData = await generateQuiz(validDomain, topic);
      setQuiz(quizData);
      knowledgeData.quizData = quizData;
      saveKnowledgeData(validDomain, knowledgeData);
      setQuizStatus('ready');
      setShowQuiz(true);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      setQuizStatus('error');
    }
  };

  const handleQuizComplete = (result: QuizResult) => {
    if (!validDomain) return;
    
    const knowledgeData = getKnowledgeData(validDomain);
    knowledgeData.quizResults = result;
    saveKnowledgeData(validDomain, knowledgeData);
    
    // Update progress and apply rewards
    updateKnowledgeProgress(validDomain, result.score, result.timeTaken);
    
    // Check for achievements
    const isPerfect = result.score === 100;
    const updatedProfile = getUserProfile();
    const newAchievements = updateKnowledgeCompletion(isPerfect, updatedProfile.level, updatedProfile.visibleStats);
    if (newAchievements.length > 0) {
      toast({
        title: '🏆 Achievement Unlocked!',
        description: `You unlocked ${newAchievements.length} new achievement${newAchievements.length > 1 ? 's' : ''}!`,
      });
    }
    
    setResults(result);
    setShowQuiz(false);
    setShowResults(true);
  };

  if (!validDomain) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Domain</h1>
          <Button onClick={() => navigate(-1)}>Return</Button>
        </div>
      </div>
    );
  }

  const domainInfo = DOMAIN_INFO[validDomain];

  if (showResults && results) {
    return (
      <KnowledgeResults
        domain={validDomain}
        domainInfo={domainInfo}
        results={results}
        onReturn={() => navigate(-1)}
      />
    );
  }

  if (showQuiz && quiz) {
    return (
      <KnowledgeQuiz
        domain={validDomain}
        domainInfo={domainInfo}
        topic={topic!}
        quiz={quiz}
        onComplete={handleQuizComplete}
        onBack={() => setShowQuiz(false)}
      />
    );
  }

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-6">
        <button
          onClick={() => navigate('/knowledge-lab')}
          className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all w-max mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>[ RETURN TO ARCHIVES ]</span>
        </button>
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2 text-white anime-glow-text">
            <BookOpen className="w-5 h-5 text-[#9fd3ff]" />
            {domainInfo.name}
          </h1>
          <p className="text-white/70 text-xs mt-0.5">{domainInfo.description}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full">
        {topicStatus === 'loading' && (
          <div className="text-center text-white/80 py-12">
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-[#9fd3ff]" />
            <p className="text-xs font-mono">THEIA: CALIBRATING KNOWLEDGE PROTOCOLS...</p>
          </div>
        )}
        
        {topicStatus === 'error' && (
          <div className="text-center text-red-400 py-12">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" />
            <p className="text-xs font-mono">THEIA: OFFLINE. UNABLE TO CALIBRATE PROTOCOLS.</p>
          </div>
        )}
        
        {topicStatus === 'ready' && topic && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown space-y-6">
            <div className="border-b border-white/20 pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white anime-glow-text">{topic.title}</h2>
                <span className="text-xs font-mono px-2 py-0.5 border border-white/40 text-[#9fd3ff] bg-black/50 w-max">
                  {topic.difficulty} Rank
                </span>
              </div>
              <p className="text-[#9fd3ff] text-xs mb-2 font-mono">{topic.category}</p>
              <p className="text-sm leading-relaxed text-gray-300">{topic.description}</p>
            </div>

            <div className="p-4 bg-[#061424]/75 border border-white/45 rounded-[2px] space-y-3 shadow-[inset_0_0_14px_rgba(0,212,255,0.08)]">
              <h3 className="font-bold flex items-center gap-2 text-sm text-white">
                <BookOpen className="w-4 h-4 text-[#9fd3ff] flex-shrink-0" />
                Key Learning Points:
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm">
                {topic.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-200">
                    <span className="text-[#9fd3ff] font-mono font-bold">{index + 1}.</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2">
              {quizStatus === 'loading' ? (
                <button disabled className="w-full py-3 border border-white/30 bg-black/40 text-gray-400 font-mono text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#9fd3ff]" />
                  Generating Trial Questions...
                </button>
              ) : (
                <button
                  onClick={handleStartQuiz}
                  className="w-full py-3 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] hover:border-white"
                >
                  START TRIAL QUIZ
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

