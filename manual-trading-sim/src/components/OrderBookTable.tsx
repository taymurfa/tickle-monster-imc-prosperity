import React from 'react';
import { BookLevel, UserOrder } from '../lib/auction';

interface Props {
  bids: BookLevel[];
  asks: BookLevel[];
  userOrder: UserOrder | null;
  clearingPrice: number | null;
}

function pct(vol: number, max: number) {
  return max > 0 ? Math.round((vol / max) * 100) : 0;
}

export function OrderBookTable({ bids, asks, userOrder, clearingPrice }: Props) {
  const sortedBids = [...bids].sort((a, b) => b.price - a.price);
  const sortedAsks = [...asks].filter(l => l.volume > 0).sort((a, b) => a.price - b.price);

  // Cumulative volumes
  let cumBid = 0;
  const bidCum = sortedBids.map(b => { cumBid += b.volume; return cumBid; });

  let cumAsk = 0;
  const askCum = sortedAsks.map(a => { cumAsk += a.volume; return cumAsk; });

  const maxVol = Math.max(
    ...sortedBids.map(b => b.volume),
    ...sortedAsks.map(a => a.volume),
    1
  );

  // Does the user's price match an existing book level?
  const userPriceOnBidSide = userOrder ? sortedBids.some(b => b.price === userOrder.price) : false;
  const userPriceOnAskSide = userOrder ? sortedAsks.some(a => a.price === userOrder.price) : false;

  return (
    <div className="ob-wrap">
      <table className="ob-table">
        <thead>
          <tr>
            <th className="th-cumul">Cumul</th>
            <th className="th-vol">Volume</th>
            <th className="th-price">Price</th>
            <th className="th-price">Price</th>
            <th className="th-vol">Volume</th>
            <th className="th-cumul">Cumul</th>
          </tr>
        </thead>
        <tbody>
          {/* Render asks in reverse (highest first, lowest ask nearest middle) */}
          {[...sortedAsks].reverse().map((ask, ri) => {
            const i = sortedAsks.length - 1 - ri;
            const isClearing = clearingPrice === ask.price;
            const barW = pct(ask.volume, maxVol);
            return (
              <tr key={`ask-${ask.price}`} className={`ob-ask-row${isClearing ? ' ob-clearing-row' : ''}`}>
                <td className="td-cumul ask-cumul">{askCum[i].toLocaleString()}</td>
                <td className="td-vol ask-vol">
                  <span className="vol-bar-wrap ask-bar-wrap">
                    <span className="vol-bar ask-bar" style={{ width: `${barW}%` }} />
                    <span className="vol-num">{ask.volume.toLocaleString()}</span>
                  </span>
                </td>
                <td className={`td-price ask-price${isClearing ? ' clearing-price-cell' : ''}`}>{ask.price}</td>
                <td className="td-price" />
                <td className="td-vol" />
                <td className="td-cumul" />
              </tr>
            );
          })}

          {/* Spread row */}
          <tr className="ob-spread-row">
            <td colSpan={3} className="spread-label-left">
              {clearingPrice !== null && (
                <span className="clearing-badge">Clearing: {clearingPrice}</span>
              )}
            </td>
            <td colSpan={3} className="spread-label-right">
              {clearingPrice === null && <span className="no-cross">no cross</span>}
            </td>
          </tr>

          {/* Bids */}
          {sortedBids.map((bid, i) => {
            const isClearing = clearingPrice === bid.price;
            const isUserLevel = userOrder?.price === bid.price;
            const barW = pct(bid.volume, maxVol);
            return (
              <tr key={`bid-${bid.price}`} className={`ob-bid-row${isClearing ? ' ob-clearing-row' : ''}`}>
                <td className="td-cumul" />
                <td className="td-vol" />
                <td className="td-price" />
                <td className={`td-price bid-price${isClearing ? ' clearing-price-cell' : ''}`}>
                  {bid.price}
                  {isUserLevel && <span className="you-badge"> ★you</span>}
                </td>
                <td className="td-vol bid-vol">
                  <span className="vol-bar-wrap bid-bar-wrap">
                    <span className="vol-bar bid-bar" style={{ width: `${barW}%` }} />
                    <span className="vol-num">{bid.volume.toLocaleString()}</span>
                  </span>
                </td>
                <td className="td-cumul bid-cumul">{bidCum[i].toLocaleString()}</td>
              </tr>
            );
          })}

          {/* User order row when their price isn't already a book bid level */}
          {userOrder && !userPriceOnBidSide && !userPriceOnAskSide && (
            <tr className="ob-bid-row ob-user-row">
              <td className="td-cumul" />
              <td className="td-vol" />
              <td className="td-price" />
              <td className="td-price bid-price user-price-cell">
                {userOrder.price} <span className="you-badge">★you</span>
              </td>
              <td className="td-vol bid-vol">
                <span className="vol-num user-vol">{userOrder.volume.toLocaleString()}</span>
              </td>
              <td className="td-cumul" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
