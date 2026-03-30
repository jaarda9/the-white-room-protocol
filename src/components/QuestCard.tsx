import { Quest } from '@/lib/types';
import { Button } from './ui/button';
import { Clock, CheckCircle2 } from 'lucide-react';

interface QuestCardProps {
  quest: Quest;
  onStart?: (quest: Quest) => void;
}

const CATEGORY_STYLES = {
  mental: { label: 'MNT', cssVar: '--info' },
  physical: { label: 'PHY', cssVar: '--critical' },
  social: { label: 'SPR', cssVar: '--warning' },
};

export const QuestCard = ({ quest, onStart }: QuestCardProps) => {
  const style = CATEGORY_STYLES[quest.type];

  return (
    <div
      className="bg-background border-l-2 px-3 py-2 hover:bg-accent/20 transition-colors"
      style={{ borderLeftColor: `hsl(var(${style.cssVar}))` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="data-readout text-[0.55rem] font-bold"
              style={{ color: `hsl(var(${style.cssVar}))` }}
            >
              {style.label}
            </span>
            <span className="data-readout text-[0.55rem] text-muted-foreground">
              LV.{quest.difficulty}
            </span>
          </div>
          <h3 className="text-xs font-medium truncate">{quest.title}</h3>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 data-readout text-[0.55rem] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {quest.duration}m
            </span>
            <span>+{quest.xp}xp</span>
          </div>

          {quest.completed ? (
            <div className="flex items-center gap-1 text-[0.6rem] text-success">
              <CheckCircle2 className="h-3 w-3" />
              <span className="data-readout">DONE</span>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStart?.(quest)}
              className="h-5 px-2 text-[0.55rem] data-readout border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              START
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
