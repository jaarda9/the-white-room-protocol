import { useMemo } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import { ATTRIBUTE_BAR_VISUAL_MAX } from '@/lib/attribute-scaling';
import type { Attributes, AttributeType } from '@/lib/types';

const ATTR_ORDER: AttributeType[] = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

type AttributeRadarChartProps = {
  attributes: Attributes;
};

export function AttributeRadarChart({ attributes }: AttributeRadarChartProps) {
  const data = useMemo(
    () =>
      ATTR_ORDER.map((key) => ({
        stat: key,
        value: Math.max(0, attributes[key] ?? 0),
      })),
    [attributes],
  );

  return (
    <div className="w-full min-w-0 h-[260px] sm:h-[300px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="78%" data={data}>
          <PolarGrid className="stroke-border" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, ATTRIBUTE_BAR_VISUAL_MAX]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Value"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.25}
            strokeWidth={1.5}
            animationBegin={0}
            animationDuration={200}
            isAnimationActive
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
