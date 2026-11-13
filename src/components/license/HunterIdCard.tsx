import { forwardRef, useId, useState } from 'react';
import type { Attributes } from '@/lib/types';
import { barcodeBars, licenseCategories, mainClassName, type ClassStatus, type LicenseRank } from '@/lib/hunter-license';
import { systemSound } from '@/lib/system-sound';

export interface HunterIdData {
  name: string;
  rank: LicenseRank;
  /** 12 digits, or '' while the handle is still unknown. */
  licenseNo: string;
  handle?: string;
  level: number;
  title?: string;
  stats: Attributes;
  /** Training history per attribute (tie-break for the main class); optional. */
  points?: Partial<Attributes>;
  /** ISO date of registration; '' when unknown. */
  issued?: string;
  /** JPEG/PNG data URL; omitted = silhouette. */
  photo?: string;
}

const W = 856;
const H = 540;
const SANS = "'Arial Black', 'Helvetica Neue', Arial, Helvetica, sans-serif";
const LABEL = 'Arial, Helvetica, sans-serif';
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export const RANK_COLORS: Record<LicenseRank, string> = {
  E: '#cbd5e1',
  D: '#4ade80',
  C: '#22d3ee',
  B: '#60a5fa',
  A: '#c084fc',
  S: '#fbbf24',
};

const clip = (s: string, max: number) => {
  const t = (s || '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const formatIssued = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Rounded card outline with the notched sides of an Association license. */
function Shell({ ids, children }: { ids: Record<string, string>; children: React.ReactNode }) {
  return (
    <>
      <defs>
        <linearGradient id={ids.bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0d2741" />
          <stop offset="1" stopColor="#050f1c" />
        </linearGradient>
        <linearGradient id={ids.band} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b6189" />
          <stop offset="1" stopColor="#1d3654" />
        </linearGradient>
        <linearGradient id={ids.chip} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#d4a017" />
          <stop offset="1" stopColor="#8a6508" />
        </linearGradient>
        <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="30" fill={`url(#${ids.bg})`} stroke="#7cc4ef" strokeOpacity="0.55" strokeWidth="3" />
      <path d={`M2 32 Q2 2 32 2 H${W - 32} Q${W - 2} 2 ${W - 2} 32 V88 H2 Z`} fill={`url(#${ids.band})`} />
      {/* body panel with chamfered notches */}
      <path
        d={`M36 104 H800 L820 124 V230 L836 246 V456 L800 504 H60 L36 480 V330 L20 314 V190 L36 174 Z`}
        fill="#0b1a2c"
        stroke="#9fd3ff"
        strokeOpacity="0.28"
        strokeWidth="2"
      />
      {children}
    </>
  );
}

function useSvgIds() {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  return {
    bg: `lic-bg-${raw}`,
    band: `lic-band-${raw}`,
    chip: `lic-chip-${raw}`,
    glow: `lic-glow-${raw}`,
    photo: `lic-photo-${raw}`,
  };
}

/** Visual tier of each Category box: the main class stands out, secondaries stay quiet. */
const CLASS_STYLE: Record<ClassStatus, { fill: string; stroke: string; strokeWidth: number; text: string; weight: number }> = {
  main: { fill: '#67e8f9', stroke: '#cffafe', strokeWidth: 2.5, text: '#04202e', weight: 900 },
  advanced: { fill: 'rgba(192,132,252,0.16)', stroke: '#c084fc', strokeWidth: 2, text: '#f3e8ff', weight: 700 },
  secondary: { fill: 'rgba(34,211,238,0.06)', stroke: '#3f8fa8', strokeWidth: 1.5, text: '#9fc9d8', weight: 600 },
  locked: { fill: 'none', stroke: '#4b6480', strokeWidth: 1.5, text: '#5b7591', weight: 400 },
};

/** Front face. forwardRef so the page can export it as an image. */
export const HunterIdFront = forwardRef<SVGSVGElement, { data: HunterIdData }>(function HunterIdFront({ data }, ref) {
  const ids = useSvgIds();
  const cats = licenseCategories(data.stats, data.points);
  const bars = barcodeBars(data.licenseNo || data.name);
  const rankColor = RANK_COLORS[data.rank] || RANK_COLORS.E;
  const initial = (data.name || '?').trim().charAt(0).toUpperCase() || '?';

  let barY = 150;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Hunter License of ${data.name}, ${data.rank}-Rank`} style={{ display: 'block' }}>
      <Shell ids={ids}>
        <text x="46" y="60" fontFamily={SANS} fontSize="38" fontWeight="900" fill="#ffffff" letterSpacing="1">
          Hunter&apos;s License
        </text>
        <text x={W - 44} y="56" textAnchor="end" fontFamily="Georgia, 'Times New Roman', serif" fontSize="23" fill="#d6ebff" textDecoration="underline">
          Hunters Association
        </text>

        {/* photo */}
        <defs>
          <clipPath id={ids.photo}>
            <rect x="64" y="136" width="200" height="250" />
          </clipPath>
        </defs>
        <rect x="64" y="136" width="200" height="250" fill="#14263b" />
        {data.photo ? (
          <image href={data.photo} x="64" y="136" width="200" height="250" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${ids.photo})`} />
        ) : (
          <g clipPath={`url(#${ids.photo})`}>
            <circle cx="164" cy="232" r="46" fill="#24405f" />
            <path d="M84 392 Q90 300 164 292 Q238 300 244 392 Z" fill="#24405f" />
            <text x="164" y="248" textAnchor="middle" fontFamily={SANS} fontSize="44" fontWeight="900" fill="#7fb3dd">
              {initial}
            </text>
          </g>
        )}
        <rect x="64" y="136" width="200" height="250" fill="none" stroke="#9fd3ff" strokeOpacity="0.6" strokeWidth="2" />

        {/* chip */}
        <rect x="74" y="414" width="88" height="64" rx="12" fill={`url(#${ids.chip})`} stroke="#6b4e05" strokeWidth="1.5" />
        <path d="M74 446 H104 M132 446 H162 M104 414 V478 M132 414 V478 M104 432 L118 446 L132 432 M104 460 L118 446 L132 460" stroke="#6b4e05" strokeWidth="1.6" fill="none" />

        {/* fields */}
        <text x="300" y="156" fontFamily={LABEL} fontSize="19" fill="#8fb4d6">License No.</text>
        <text x="306" y="194" fontFamily={MONO} fontSize="31" fontWeight="700" fill="#ffffff" letterSpacing="2">
          {data.licenseNo || 'PENDING…'}
        </text>
        <text x="610" y="156" fontFamily={LABEL} fontSize="19" fill="#8fb4d6">Rank:</text>
        <text x="612" y="226" fontFamily={SANS} fontSize="70" fontWeight="900" fill={rankColor} filter={`url(#${ids.glow})`}>
          {data.rank}
        </text>
        <text x="300" y="244" fontFamily={LABEL} fontSize="19" fill="#8fb4d6">Name:</text>
        <text x="306" y="284" fontFamily={SANS} fontSize="32" fontWeight="900" fill="#ffffff">
          {clip(data.name, 22)}
        </text>
        <text x="300" y="324" fontFamily={LABEL} fontSize="19" fill="#8fb4d6">Category:</text>
        {cats.map((c, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 300 + col * 164;
          const y = 336 + row * 42;
          const st = CLASS_STYLE[c.status];
          return (
            <g key={c.name}>
              <rect
                x={x}
                y={y}
                width="156"
                height="34"
                fill={st.fill}
                stroke={st.stroke}
                strokeWidth={st.strokeWidth}
                strokeDasharray={c.status === 'locked' ? '3 3' : undefined}
                filter={c.status === 'main' ? `url(#${ids.glow})` : undefined}
              />
              <text x={x + 78} y={y + 23} textAnchor="middle" fontFamily={LABEL} fontSize="17" fontWeight={st.weight} fill={st.text}>
                {c.status === 'locked' ? '-- --' : c.name}
              </text>
              {c.status === 'main' && (
                <text x={x + 151} y={y + 11} textAnchor="end" fontFamily={LABEL} fontSize="9" fontWeight="700" fill="#082f49" letterSpacing="0.5">
                  MAIN
                </text>
              )}
            </g>
          );
        })}
        <text x="186" y="492" fontFamily={LABEL} fontSize="15" fontStyle="italic" fill="#8fa7bf">
          Certified by the Hunters Association to operate as a Hunter.
        </text>

        {/* barcode */}
        {bars.map((b, i) => {
          const y = barY;
          barY += b * 3 + 6;
          return y + b * 3 <= 470 ? <rect key={i} x="826" y={y} width="20" height={b * 3} fill="#cfe6ff" opacity="0.85" /> : null;
        })}
      </Shell>
    </svg>
  );
});

const STAT_ORDER: (keyof Attributes)[] = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

export function HunterIdBack({ data }: { data: HunterIdData }) {
  const ids = useSvgIds();
  const rankColor = RANK_COLORS[data.rank] || RANK_COLORS.E;
  const maxStat = Math.max(30, ...STAT_ORDER.map((k) => data.stats[k] || 0));
  const rows: [string, string][] = [
    ['Class', mainClassName(data.stats, data.points) || 'Unclassified'],
    ['Level', `LV.${data.level}`],
    ['Title', clip(data.title || '—', 22)],
    ['Handle', data.handle || '—'],
    ['Issued', formatIssued(data.issued)],
  ];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Hunter License, reverse side" style={{ display: 'block' }}>
      <Shell ids={ids}>
        <text x="46" y="60" fontFamily={SANS} fontSize="34" fontWeight="900" fill="#ffffff" letterSpacing="1">
          Hunter Record
        </text>
        <text x={W - 44} y="58" textAnchor="end" fontFamily={SANS} fontSize="40" fontWeight="900" fill={rankColor} filter={`url(#${ids.glow})`}>
          {data.rank}-RANK
        </text>
        {rows.map(([k, v], i) => (
          <g key={k}>
            <text x="70" y={156 + i * 60} fontFamily={LABEL} fontSize="19" fill="#8fb4d6">{k}</text>
            <text x="70" y={184 + i * 60} fontFamily={MONO} fontSize="25" fontWeight="700" fill="#ffffff">{v}</text>
          </g>
        ))}
        <text x="440" y="146" fontFamily={LABEL} fontSize="19" fill="#8fb4d6">Attributes</text>
        {STAT_ORDER.map((k, i) => {
          const v = data.stats[k] || 0;
          const y = 166 + i * 50;
          const w = Math.max(4, Math.round((Math.min(v, maxStat) / maxStat) * 250));
          return (
            <g key={k}>
              <text x="440" y={y + 24} fontFamily={MONO} fontSize="21" fontWeight="700" fill="#cfe6ff">{k}</text>
              <rect x="500" y={y + 6} width="250" height="22" fill="#14263b" stroke="#2c4867" />
              <rect x="500" y={y + 6} width={w} height="22" fill="#22d3ee" opacity="0.8" />
              <text x="790" y={y + 24} textAnchor="end" fontFamily={MONO} fontSize="21" fontWeight="700" fill="#ffffff">{v}</text>
            </g>
          );
        })}
        <text x={W / 2} y="492" textAnchor="middle" fontFamily={LABEL} fontSize="15" fontStyle="italic" fill="#8fa7bf">
          Main class: your highest attribute (15+). Others show within 3 of it.
        </text>
      </Shell>
    </svg>
  );
}

/** Tap to flip between front and back. */
export function FlippableHunterId({
  data,
  frontRef,
  flipped: controlled,
  onFlip,
}: {
  data: HunterIdData;
  frontRef?: React.Ref<SVGSVGElement>;
  flipped?: boolean;
  onFlip?: (next: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const flipped = controlled ?? own;
  const toggle = () => {
    systemSound.playClick();
    const next = !flipped;
    if (onFlip) onFlip(next);
    if (controlled === undefined) setOwn(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={flipped ? 'Show the front of the license' : 'Show the back of the license'}
      className="block w-full max-w-[560px] mx-auto rounded-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      style={{ perspective: '1200px' }}
    >
      <div
        className="relative w-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none', aspectRatio: `${W} / ${H}` }}
      >
        <div className="absolute inset-0 drop-shadow-[0_0_18px_rgba(0,212,255,0.25)]" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <HunterIdFront ref={frontRef} data={data} />
        </div>
        <div
          className="absolute inset-0 drop-shadow-[0_0_18px_rgba(0,212,255,0.25)]"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <HunterIdBack data={data} />
        </div>
      </div>
    </button>
  );
}

/** Renders an SVG element to a PNG blob (2× resolution). Throws if the browser can't. */
export async function svgToPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(W * 2));
  clone.setAttribute('height', String(H * 2));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('render failed'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(img, 0, 0, W * 2, H * 2);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/png')
  );
}
