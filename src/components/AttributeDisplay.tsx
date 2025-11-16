import { Attributes, AttributeType } from '@/lib/types';

interface AttributeDisplayProps {
  attributes: Attributes;
  accumulated?: Attributes;
  compact?: boolean;
}

const ATTRIBUTE_INFO: Record<AttributeType, { name: string; color: string }> = {
  STR: { name: 'Strength', color: 'attr-str' },
  AGI: { name: 'Agility', color: 'attr-agi' },
  VIT: { name: 'Vitality', color: 'attr-vit' },
  INT: { name: 'Intelligence', color: 'attr-int' },
  PER: { name: 'Perception', color: 'attr-per' },
  WIS: { name: 'Wisdom', color: 'attr-wis' },
};

export const AttributeDisplay = ({ attributes, accumulated, compact = false }: AttributeDisplayProps) => {
  const attrs = Object.keys(attributes) as AttributeType[];

  if (compact) {
    return (
      <div className="grid grid-cols-6 gap-2">
        {attrs.map((attr) => (
          <div key={attr} className="text-center">
            <div className="text-xs text-muted-foreground mb-1">{attr}</div>
            <div className="font-mono-data text-lg font-bold">
              {attributes[attr]}
              {accumulated && accumulated[attr] > 0 && (
                <span className="text-xs text-info ml-1">+{accumulated[attr]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attrs.map((attr) => {
        const info = ATTRIBUTE_INFO[attr];
        const value = attributes[attr];
        const accValue = accumulated?.[attr] || 0;
        const maxValue = 50; // visual max for bar
        const percentage = (value / maxValue) * 100;

        return (
          <div key={attr}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-sm font-bold w-8">{attr}</span>
                <span className="text-xs text-muted-foreground">{info.name}</span>
              </div>
              <div className="font-mono-data text-sm">
                {value}
                {accValue > 0 && (
                  <span className="text-xs text-info ml-1">+{accValue}</span>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-secondary relative overflow-hidden">
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: `hsl(var(--${info.color}))`
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
