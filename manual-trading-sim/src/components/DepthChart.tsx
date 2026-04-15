import React from 'react';
import { BookLevel, UserOrder, buildDemandCurve, buildSupplyCurve } from '../lib/auction';

interface Props {
  bids: BookLevel[];
  asks: BookLevel[];
  userOrder: UserOrder | null;
  clearingPrice: number | null;
}

/** Convert a series of (price, cumVol) depth points into an SVG step-path string. */
function stepsToPath(
  pts: { price: number; cumVolume: number }[],
  xScale: (p: number) => number,
  yScale: (v: number) => number
): string {
  if (pts.length === 0) return '';
  return pts
    .map(({ price, cumVolume }, i) =>
      `${i === 0 ? 'M' : 'L'} ${xScale(price).toFixed(1)} ${yScale(cumVolume).toFixed(1)}`
    )
    .join(' ');
}

export function DepthChart({ bids, asks, userOrder, clearingPrice }: Props) {
  const W = 480;
  const H = 180;
  const pad = { top: 20, right: 16, bottom: 28, left: 52 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const supply = buildSupplyCurve(asks);
  const demand = buildDemandCurve(bids, userOrder);

  if (supply.length === 0 && demand.length === 0) return null;

  // Price range
  const allPrices = [
    ...supply.map(p => p.price),
    ...demand.map(p => p.price),
    ...(clearingPrice !== null ? [clearingPrice] : []),
    ...(userOrder ? [userOrder.price] : []),
  ];
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const priceRange = rawMax - rawMin || 1;
  const minP = rawMin - priceRange * 0.05;
  const maxP = rawMax + priceRange * 0.05;

  // Volume range
  const maxCumSupply = supply.length ? supply[supply.length - 1].cumVolume : 0;
  const maxCumDemand = demand.length ? demand[demand.length - 1].cumVolume : 0;
  const maxVol = Math.max(maxCumSupply, maxCumDemand, 1);

  const xS = (p: number) => pad.left + ((p - minP) / (maxP - minP)) * plotW;
  const yS = (v: number) => pad.top + plotH - (v / maxVol) * plotH;

  const supplyPath = stepsToPath(supply, xS, yS);
  const demandPath = stepsToPath(demand, xS, yS);

  // Extend curves to chart edges for completeness
  const supplyExtended = supply.length
    ? `${supplyPath} L ${(xS(maxP)).toFixed(1)} ${yS(supply[supply.length - 1].cumVolume).toFixed(1)}`
    : '';
  const demandExtended = demand.length
    ? `M ${xS(maxP).toFixed(1)} ${yS(0).toFixed(1)} ${demandPath} L ${xS(minP).toFixed(1)} ${yS(demand[demand.length - 1].cumVolume).toFixed(1)}`
    : '';

  // Tick prices: pick a subset of distinct prices for the axis
  const tickPrices = [...new Set([...bids.map(b => b.price), ...asks.filter(a => a.volume > 0).map(a => a.price)])].sort((a, b) => a - b);

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(f => Math.round(maxVol * f));

  return (
    <div className="depth-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="depth-chart-svg" aria-label="Depth chart">
        {/* Gridlines */}
        {yTicks.map(v => (
          <line key={v}
            x1={pad.left} y1={yS(v)}
            x2={pad.left + plotW} y2={yS(v)}
            stroke="var(--grid)" strokeWidth={1}
          />
        ))}

        {/* Supply (ask) curve */}
        {supplyExtended && (
          <path d={supplyExtended} fill="none" stroke="var(--ask)" strokeWidth={2} strokeLinejoin="round" />
        )}

        {/* Demand (bid) curve */}
        {demandExtended && (
          <path d={demandExtended} fill="none" stroke="var(--bid)" strokeWidth={2} strokeLinejoin="round" />
        )}

        {/* Clearing price vertical */}
        {clearingPrice !== null && (
          <>
            <line
              x1={xS(clearingPrice)} y1={pad.top}
              x2={xS(clearingPrice)} y2={pad.top + plotH}
              stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 3"
            />
            <text x={xS(clearingPrice)} y={pad.top - 5} fill="var(--accent)" fontSize={10} textAnchor="middle" fontWeight={600}>
              {clearingPrice}
            </text>
          </>
        )}

        {/* User order price vertical (only if different from clearing) */}
        {userOrder && userOrder.price !== clearingPrice && (
          <>
            <line
              x1={xS(userOrder.price)} y1={pad.top}
              x2={xS(userOrder.price)} y2={pad.top + plotH}
              stroke="var(--user)" strokeWidth={1.5} strokeDasharray="3 3"
            />
            <text
              x={xS(userOrder.price)} y={pad.top + plotH + 18}
              fill="var(--user)" fontSize={9} textAnchor="middle"
            >
              you
            </text>
          </>
        )}

        {/* Axes */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="var(--border)" strokeWidth={1} />
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="var(--border)" strokeWidth={1} />

        {/* X ticks */}
        {tickPrices.map(p => (
          <text key={p} x={xS(p)} y={pad.top + plotH + 14} fill="var(--muted)" fontSize={9} textAnchor="middle">{p}</text>
        ))}

        {/* Y ticks */}
        {yTicks.filter(v => v > 0).map(v => (
          <g key={v}>
            <line x1={pad.left - 3} y1={yS(v)} x2={pad.left} y2={yS(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.left - 5} y={yS(v) + 3} fill="var(--muted)" fontSize={8} textAnchor="end">
              {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            </text>
          </g>
        ))}

        {/* Legend */}
        <circle cx={pad.left + 8} cy={pad.top + 8} r={4} fill="var(--bid)" />
        <text x={pad.left + 15} y={pad.top + 12} fill="var(--bid)" fontSize={9}>demand</text>
        <circle cx={pad.left + 70} cy={pad.top + 8} r={4} fill="var(--ask)" />
        <text x={pad.left + 77} y={pad.top + 12} fill="var(--ask)" fontSize={9}>supply</text>
      </svg>
    </div>
  );
}
