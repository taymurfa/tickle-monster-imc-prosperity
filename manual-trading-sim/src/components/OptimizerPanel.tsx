import React, { useState } from 'react';
import { ProductConfig } from '../lib/auction';
import { optimizeOrder, CandidateOrder } from '../lib/optimizer';

interface Props {
  product: ProductConfig;
}

function fmt(n: number, d = 0) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function OptimizerPanel({ product }: Props) {
  const [results, setResults] = useState<CandidateOrder[] | null>(null);
  const [volumeStep, setVolumeStep] = useState(1000);
  const [maxVol, setMaxVol] = useState(150_000);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // Small timeout so the UI can repaint before the sync computation
    setTimeout(() => {
      const res = optimizeOrder(product, maxVol, volumeStep, 8);
      setResults(res);
      setRunning(false);
    }, 10);
  }

  return (
    <div className="optimizer-panel">
      <div className="optimizer-controls">
        <label className="opt-field">
          <span>Vol step</span>
          <input
            type="number"
            className="opt-input"
            value={volumeStep}
            min={100}
            step={100}
            onChange={e => setVolumeStep(Number(e.target.value))}
          />
        </label>
        <label className="opt-field">
          <span>Max vol</span>
          <input
            type="number"
            className="opt-input"
            value={maxVol}
            min={1000}
            step={10_000}
            onChange={e => setMaxVol(Number(e.target.value))}
          />
        </label>
        <button className="opt-run-btn" onClick={run} disabled={running}>
          {running ? 'Searching…' : 'Find best orders'}
        </button>
      </div>

      {results !== null && (
        results.length === 0 ? (
          <p className="opt-empty">No profitable orders found in this range.</p>
        ) : (
          <div className="opt-results">
            <table className="opt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Price</th>
                  <th>Volume</th>
                  <th>Clearing</th>
                  <th>Fill</th>
                  <th>Cost</th>
                  <th>PnL</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c, i) => (
                  <tr key={i} className={i === 0 ? 'opt-best-row' : ''}>
                    <td className="opt-rank">{i === 0 ? '★' : i + 1}</td>
                    <td>{c.price}</td>
                    <td>{fmt(c.volume)}</td>
                    <td>{c.result.clearingPrice ?? '—'}</td>
                    <td>{fmt(c.result.userFilledQty)}</td>
                    <td className="value-cost">{fmt(c.result.cost)}</td>
                    <td className={`pnl-value ${c.result.pnl > 0 ? 'pnl-pos' : c.result.pnl < 0 ? 'pnl-neg' : 'pnl-zero'}`}>
                      {(c.result.pnl >= 0 ? '+' : '') + fmt(c.result.pnl, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="opt-note">
              Ranked by PnL → fill qty → lowest cost → lowest price.
              Deduplicated: only the minimum volume to achieve each (price, fill, PnL) is shown.
            </p>
          </div>
        )
      )}
    </div>
  );
}
