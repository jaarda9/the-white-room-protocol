import { Quest } from '@/lib/types';
import { Button } from './ui/button';
import { Clock, CheckCircle2 } from 'lucide-react';

interface QuestCardProps {
  quest: Quest;
  onStart?: (quest: Quest) => void;
}

const CATEGORY_STYLES = {
  mental: { label: 'MNT', tag: '◆' },
  physical: { label: 'PHY', tag: '■' },
  social: { label: 'SPR', tag: '▲' },
};

export const QuestCard = ({ quest, onStart }: QuestCardProps) => {
  const style = CATEGORY_STYLES[quest.type];

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors border-b border-border last:border-b-0">
      <span className="data-readout text-[0.55rem] text-primary">{style.tag}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="data-readout text-[0.5rem] text-muted-foreground">[{style.label}]</span>
          <span className="data-readout text-[0.5rem] text-muted-foreground">LV.{quest.difficulty}</span>
        </div>
        <h3 className="text-xs text-foreground truncate">{quest.title}</h3>
      </div>

      <div className="flex items-center gap-3 shrink-0 data-readout text-[0.55rem] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {quest.duration}m
        </span>
        <span>+{quest.xp}xp</span>
      </div>

      {quest.completed ? (
        <span className="data-readout text-[0.55rem] text-primary text-glow flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          DONE
        </span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStart?.(quest)}
          className="h-5 px-2 text-[0.5rem] data-readout border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
        >
          EXEC
        </Button>
      )}
    </div>
  );
};
