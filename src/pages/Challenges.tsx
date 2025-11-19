import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActiveChallenges } from '@/components/ActiveChallenges';

export default function Challenges() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Time-Limited Challenges</h1>
            <p className="text-muted-foreground">
              Complete these special challenges before time runs out to earn exclusive rewards
            </p>
          </div>

          <ActiveChallenges />
        </div>
      </div>
    </div>
  );
}
