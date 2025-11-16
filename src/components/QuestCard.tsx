import { Quest } from '@/lib/types';
import { Button } from './ui/button';
import { Clock, CheckCircle2 } from 'lucide-react';

interface QuestCardProps {
  quest: Quest;
  onStart?: (quest: Quest) => void;
}

const CATEGORY_STYLES = {
  mental: {
    label: 'MENTAL',
    borderColor: 'border-l-info',
  },
  physical: {
    label: 'PHYSICAL',
    borderColor: 'border-l-critical',
  },
  social: {
    label: 'SOCIAL',
    borderColor: 'border-l-warning',
  },
};

export const QuestCard = ({ quest, onStart }: QuestCardProps) => {
  const style = CATEGORY_STYLES[quest.type];

  return (
    <div className={`bg-card border border-border border-l-2 ${style.borderColor} p-4 hover:bg-surface/50 transition-colors`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono-data text-muted-foreground">{style.label}</span>
            <span className="text-xs font-mono-data text-muted-foreground">
              LV.{quest.difficulty}
            </span>
          </div>
          <h3 className="font-medium text-sm mb-1">{quest.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {quest.description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-3 text-xs font-mono-data text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{quest.duration}m</span>
          </div>
          <div>XP: +{quest.xp}</div>
        </div>

        {quest.completed ? (
          <div className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" />
            <span className="font-mono-data">COMPLETE</span>
          </div>
        ) : (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onStart?.(quest)}
            className="h-7 text-xs font-mono-data"
          >
            START
          </Button>
        )}
      </div>
    </div>
  );
};
