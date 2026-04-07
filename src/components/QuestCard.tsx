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
  const weekdayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const displayTitle =
    quest.type === 'physical'
      ? `${weekdayLabel} — ${quest.title.replace(/^Monday Protocol — |^Tuesday Protocol — |^Wednesday Protocol — |^Thursday Protocol — |^Friday Protocol — |^Saturday Protocol — |^Sunday Protocol — /, '')}`
      : quest.title;

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-b-0">
      <span className="data-readout text-xs text-primary shrink-0">{style.tag}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="data-readout text-xs text-muted-foreground">[{style.label}]</span>
          <span className="data-readout text-xs text-muted-foreground">LV.{quest.difficulty}</span>
        </div>
        <h3 className="text-sm text-foreground truncate">{displayTitle}</h3>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0 data-readout text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {quest.duration}m
        </span>
        <span className="hidden sm:inline">+{quest.xp}xp</span>
      </div>

      {quest.completed ? (
        <span className="data-readout text-xs text-primary text-glow flex items-center gap-1 shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">DONE</span>
        </span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStart?.(quest)}
          className="h-6 px-3 text-xs data-readout border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground shrink-0"
        >
          EXEC
        </Button>
      )}
    </div>
  );
};
