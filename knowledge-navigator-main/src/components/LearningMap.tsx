import { motion } from 'framer-motion';
import { COURSE_NODES, CONNECTIONS, NodeStatus } from '@/data/courseData';
import { Lock, CheckCircle2, Sparkles, Star } from 'lucide-react';

interface LearningMapProps {
  getNodeStatus: (id: string) => NodeStatus;
  onSelectNode: (id: string) => void;
}

const statusConfig: Record<NodeStatus, { ring: string; bg: string; icon: React.ReactNode; glow: string }> = {
  locked: {
    ring: 'border-muted-foreground/30',
    bg: 'bg-muted/50',
    icon: <Lock className="w-5 h-5 text-muted-foreground/50" />,
    glow: '',
  },
  available: {
    ring: 'border-primary',
    bg: 'bg-secondary',
    icon: <Sparkles className="w-5 h-5 text-primary" />,
    glow: 'node-pulse',
  },
  completed: {
    ring: 'border-success',
    bg: 'bg-success/10',
    icon: <CheckCircle2 className="w-5 h-5 text-success" />,
    glow: 'glow-success',
  },
};

export default function LearningMap({ getNodeStatus, onSelectNode }: LearningMapProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto map-grid rounded-2xl p-8" style={{ minHeight: 520 }}>
      {/* SVG connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {CONNECTIONS.map(([fromId, toId]) => {
          const from = COURSE_NODES.find(n => n.id === fromId)!;
          const to = COURSE_NODES.find(n => n.id === toId)!;
          const fromStatus = getNodeStatus(fromId);
          const toStatus = getNodeStatus(toId);
          const active = fromStatus === 'completed';
          return (
            <line
              key={`${fromId}-${toId}`}
              x1={`${from.x}%`} y1={`${from.y}%`}
              x2={`${to.x}%`} y2={`${to.y}%`}
              stroke={active ? 'hsl(142 71% 45% / 0.5)' : 'hsl(225 15% 20% / 0.5)'}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={active ? 'none' : '6 4'}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {COURSE_NODES.map((node, i) => {
        const status = getNodeStatus(node.id);
        const config = statusConfig[status];
        const clickable = status !== 'locked';

        return (
          <motion.button
            key={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 200 }}
            className={`absolute flex flex-col items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 group ${clickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: 1 }}
            onClick={() => clickable && onSelectNode(node.id)}
            disabled={!clickable}
          >
            <div className={`w-14 h-14 rounded-xl border-2 ${config.ring} ${config.bg} ${config.glow} flex items-center justify-center transition-all duration-300 ${clickable ? 'group-hover:scale-110' : ''}`}>
              {config.icon}
            </div>
            <span className={`text-xs font-medium max-w-[100px] text-center leading-tight ${status === 'locked' ? 'text-muted-foreground/40' : 'text-foreground'}`}>
              {node.title}
            </span>
            {node.isBonus && (
              <Star className="w-3 h-3 text-accent absolute -top-1 -right-1" />
            )}
            {status === 'completed' && node.id in {} === false && (
              <span className="text-[10px] text-success font-medium">+{node.xpReward} XP</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
