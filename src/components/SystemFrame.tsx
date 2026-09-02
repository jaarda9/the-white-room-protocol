import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SystemFrameProps {
  /** Title shown in the bordered chip at the top of the window (e.g. STATUS, QUEST INFO). */
  title?: string;
  /** Small glyph shown to the left of the title chip, like the "!" of the quest window. */
  glyph?: ReactNode;
  /** Aligns the title chip like the anime: centered for STATUS, left-with-glyph for QUEST INFO. */
  titleAlign?: 'center' | 'left';
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * The Solo Leveling "System" window: a floating holographic pane with
 * cut corners, a doubled ice-blue rim and a bordered title plate.
 * Nothing else should surround it — one window per screen.
 */
export const SystemFrame = ({
  title,
  glyph,
  titleAlign = 'center',
  children,
  className,
  bodyClassName,
}: SystemFrameProps) => (
  <div className={cn('sys-frame', className)}>
    <div className="sys-frame-inner">
      {title && (
        <div className={cn('sys-frame-head', titleAlign === 'left' && 'sys-frame-head--left')}>
          {glyph && <span className="sys-glyph">{glyph}</span>}
          <span className="sys-frame-title">{title}</span>
        </div>
      )}
      <div className={cn('sys-frame-body', bodyClassName)}>{children}</div>
    </div>
  </div>
);

/** Inset sub-panel used inside a System window (the HP/MP strip, the stat block). */
export const SystemPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={cn('sys-panel', className)}>{children}</div>;

export default SystemFrame;
