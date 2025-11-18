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
          <Button onClick={() => navigate('/knowledge-lab')}>Return to Knowledge Lab</Button>
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
        onReturn={() => navigate('/knowledge-lab')}
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
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/knowledge-lab')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Knowledge Lab
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-primary" />
                {domainInfo.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {domainInfo.description}
              </p>
            </div>
            <Badge variant={topicStatus === 'ready' ? 'default' : 'outline'} className="font-mono text-xs">
              ARCHITECT: {topicStatus === 'ready' ? 'OPTIMIZED' : topicStatus === 'loading' ? 'CALIBRATING' : 'OFFLINE'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {topicStatus === 'loading' && (
          <div className="text-center text-muted-foreground py-8">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
            <p>ARCHITECT: CALIBRATING KNOWLEDGE PROTOCOLS...</p>
          </div>
        )}
        
        {topicStatus === 'error' && (
          <div className="text-center text-destructive py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p>ARCHITECT: OFFLINE. UNABLE TO CALIBRATE KNOWLEDGE PROTOCOLS.</p>
          </div>
        )}
        
        {topicStatus === 'ready' && topic && (
          <Card className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold">{topic.title}</h2>
                <Badge className={DIFFICULTY_COLORS[topic.difficulty] || 'text-foreground'}>
                  {topic.difficulty} Rank
                </Badge>
              </div>
              <p className="text-muted-foreground mb-2">{topic.category}</p>
              <p className="text-sm">{topic.description}</p>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Key Learning Points:
              </h3>
              <ul className="space-y-2">
                {topic.keyPoints.map((point, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-primary font-mono">{index + 1}.</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border pt-4">
              {quizStatus === 'loading' ? (
                <Button disabled className="w-full">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Quiz...
                </Button>
              ) : (
                <Button onClick={handleStartQuiz} className="w-full" size="lg">
                  Start Quiz
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

