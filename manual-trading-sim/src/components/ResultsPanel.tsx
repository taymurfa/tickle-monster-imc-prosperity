import React from 'react';
import { AuctionResult } from '../lib/auction';

interface Props {
  result: AuctionResult;
  resaleValue: number;
  buyFee: number;
  sellFee: number;
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function ResultsPanel({ result, resaleValue, buyFee, sellFee }: Props) {
  const { clearingPrice, userFilledQty, totalMatchedQty, marketable, cost, resaleProceeds, fees, pnl } = result;

  const noFill = userFilledQty === 0;
  const hasFees = buyFee + sellFee > 0;

  return (
    <div className="results-panel">
      {/* Status banner */}
      <div className={`result-status ${noFill ? 'status-no-fill' : pnl > 0 ? 'status-profit' : pnl < 0 ? 'status-loss' : 'status-zero'}`}>
        {clearingPrice === null
          ? 'No auction crossing'
          : !marketable
          ? `Not marketable — your bid is below clearing (${clearingPrice})`
          : noFill
          ? `Clearing @ ${clearingPrice} — queue full, no fill`
          : pnl > 0
          ? `Filled ${fmt(userFilledQty)} @ ${clearingPrice} — profit`
          : pnl < 0
          ? `Filled ${fmt(userFilledQty)} @ ${clearingPrice} — loss`
          : `Filled ${fmt(userFilledQty)} @ ${clearingPrice} — breakeven`
        }
      </div>

      <div className="result-grid">
        <div className="result-row">
          <span className="result-label">Clearing price</span>
          <span className="result-value">{clearingPrice ?? '—'}</span>
        </div>
        <div className="result-row">
          <span className="result-label">Total matched (market)</span>
          <span className="result-value">{fmt(totalMatchedQty)}</span>
        </div>
        <div className="result-row">
          <span className="result-label">Your fill</span>
          <span className={`result-value ${noFill ? 'value-muted' : 'value-highlight'}`}>
            {fmt(userFilledQty)}
          </span>
        </div>
        <div className="result-row">
          <span className="result-label">Avg execution price</span>
          <span className="result-value">{result.avgExecutionPrice ?? '—'}</span>
        </div>

        <div className="result-divider" />

        <div className="result-row">
          <span className="result-label">Cost (fill × price)</span>
          <span className="result-value value-cost">{noFill ? '—' : fmt(cost)}</span>
        </div>
        <div className="result-row">
          <span className="result-label">Resale proceeds (× {resaleValue})</span>
          <span className="result-value">{noFill ? '—' : fmt(resaleProceeds)}</span>
        </div>
        {hasFees && (
          <div className="result-row">
            <span className="result-label">Fees ({((buyFee + sellFee) * 100).toFixed(0)}¢/unit)</span>
            <span className="result-value value-cost">{noFill ? '—' : `−${fmt(fees, 2)}`}</span>
          </div>
        )}

        <div className="result-divider" />

        <div className="result-row result-pnl-row">
          <span className="result-label">Expected PnL</span>
          <span className={`result-value pnl-value ${pnl > 0 ? 'pnl-pos' : pnl < 0 ? 'pnl-neg' : 'pnl-zero'}`}>
            {noFill ? '0' : (pnl >= 0 ? '+' : '') + fmt(pnl, 2)}
          </span>
        </div>
      </div>
    </div>
  );
}
