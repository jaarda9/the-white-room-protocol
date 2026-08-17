import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SystemWindowProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  corners?: boolean;
}

/**
 * The Solo Leveling "System" notification window: clipped corners,
 * ice-blue rim glow, scanlines and an Orbitron title strip.
 */
export const SystemWindow = ({
  title,
  right,
  children,
  className,
  bodyClassName,
  corners = true,
}: SystemWindowProps) => (
  <div className={cn('system-window system-appear', corners && 'system-corners', className)}>
    {title && (
      <div className="system-title">
        <span>{title}</span>
        {right && <span className="ml-auto flex items-center gap-2">{right}</span>}
      </div>
    )}
    <div className={cn('relative p-4', bodyClassName)}>{children}</div>
  </div>
);

export default SystemWindow;
