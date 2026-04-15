import React from 'react';

interface Props {
  price: string;
  volume: string;
  onPriceChange: (v: string) => void;
  onVolumeChange: (v: string) => void;
  resaleValue: number;
  symbol: string;
}

export function TradeTicket({ price, volume, onPriceChange, onVolumeChange, resaleValue, symbol }: Props) {
  const priceNum = parseFloat(price);
  const aboveResale = !isNaN(priceNum) && priceNum >= resaleValue;

  return (
    <div className="ticket">
      <div className="ticket-header">
        <span className="ticket-side-badge buy-badge">BUY</span>
        <span className="ticket-symbol">{symbol}</span>
      </div>
      <div className="ticket-fields">
        <label className="field-label">
          Price
          <input
            className={`field-input${aboveResale ? ' input-warn' : ''}`}
            type="number"
            step="1"
            min="1"
            value={price}
            onChange={e => onPriceChange(e.target.value)}
            placeholder="e.g. 29"
          />
          {aboveResale && (
            <span className="field-warn">≥ resale ({resaleValue}) — negative EV</span>
          )}
        </label>
        <label className="field-label">
          Volume
          <input
            className="field-input"
            type="number"
            step="1000"
            min="1"
            value={volume}
            onChange={e => onVolumeChange(e.target.value)}
            placeholder="e.g. 5000"
          />
        </label>
      </div>
      <p className="ticket-note">Results update live as you type.</p>
    </div>
  );
}
