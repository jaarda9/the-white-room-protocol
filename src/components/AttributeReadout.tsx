import { Attributes, AttributeType } from '@/lib/types';

interface AttributeReadoutProps {
  attributes: Attributes;
  accumulated?: Attributes;
}

const ATTR_META: Record<AttributeType, { label: string; cssVar: string }> = {
  STR: { label: 'STR', cssVar: '--attr-str' },
  AGI: { label: 'AGI', cssVar: '--attr-agi' },
  VIT: { label: 'VIT', cssVar: '--attr-vit' },
  INT: { label: 'INT', cssVar: '--attr-int' },
  PER: { label: 'PER', cssVar: '--attr-per' },
  WIS: { label: 'WIS', cssVar: '--attr-wis' },
};

export const AttributeReadout = ({ attributes, accumulated }: AttributeReadoutProps) => {
  const attrs = Object.keys(attributes) as AttributeType[];
  const maxVal = Math.max(...attrs.map(a => attributes[a]), 50);

  return (
    <div className="space-y-2">
      {attrs.map((attr) => {
        const meta = ATTR_META[attr];
        const value = attributes[attr];
        const acc = accumulated?.[attr] || 0;
        const pct = (value / maxVal) * 100;

        return (
          <div key={attr} className="flex items-center gap-2">
            <span className="data-readout text-[0.65rem] w-6 text-muted-foreground">{meta.label}</span>
            <div className="flex-1 h-1.5 bg-secondary relative overflow-hidden">
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  backgroundColor: `hsl(var(${meta.cssVar}))`,
                  boxShadow: `0 0 6px hsl(var(${meta.cssVar}) / 0.4)`,
                }}
              />
            </div>
            <span className="data-readout text-[0.65rem] w-6 text-right text-foreground">{value}</span>
            {acc > 0 && (
              <span className="data-readout text-[0.55rem] text-primary">+{acc}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
