import React, { useMemo, useState } from 'react';
import { ALL_PRODUCTS, DRYLAND_FLAX, EMBER_MUSHROOM } from './data/orderBooks';
import { ProductConfig, UserOrder, simulateAuction } from './lib/auction';
import { OrderBookTable } from './components/OrderBookTable';
import { DepthChart } from './components/DepthChart';
import { TradeTicket } from './components/TradeTicket';
import { ResultsPanel } from './components/ResultsPanel';
import { OptimizerPanel } from './components/OptimizerPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Per-product state
// ─────────────────────────────────────────────────────────────────────────────

interface OrderInputs {
  price: string;
  volume: string;
}

function parseOrder(inputs: OrderInputs): UserOrder | null {
  const price = parseFloat(inputs.price);
  const volume = parseInt(inputs.volume, 10);
  if (isNaN(price) || isNaN(volume) || volume <= 0 || price <= 0) return null;
  return { side: 'buy', price, volume };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product section component
// ─────────────────────────────────────────────────────────────────────────────

interface ProductSectionProps {
  product: ProductConfig;
  inputs: OrderInputs;
  onInputChange: (field: 'price' | 'volume', value: string) => void;
  showOptimizer: boolean;
  onToggleOptimizer: () => void;
}

function ProductSection({ product, inputs, onInputChange, showOptimizer, onToggleOptimizer }: ProductSectionProps) {
  const userOrder = useMemo(() => parseOrder(inputs), [inputs]);
  const result = useMemo(
    () => userOrder ? simulateAuction(product, userOrder) : null,
    [product, userOrder]
  );
  const clearingPrice = result?.clearingPrice ?? null;

  return (
    <section className="product-card">
      <div className="product-header">
        <div>
          <h2 className="product-name">{product.name}</h2>
          <span className="product-symbol">{product.symbol}</span>
        </div>
        <div className="product-meta">
          <span className="meta-pill">Resale: <strong>{product.resaleValue}</strong></span>
          {(product.buyFeePerUnit + product.sellFeePerUnit) > 0 && (
            <span className="meta-pill warn-pill">
              Fee: {((product.buyFeePerUnit + product.sellFeePerUnit) * 100).toFixed(0)}¢/unit
            </span>
          )}
        </div>
      </div>

      <div className="product-body">
        {/* Left column: order book + chart */}
        <div className="col-book">
          <h3 className="col-title">Order Book</h3>
          <OrderBookTable
            bids={product.bids}
            asks={product.asks}
            userOrder={userOrder}
            clearingPrice={clearingPrice}
          />
          <h3 className="col-title chart-title">Depth Chart</h3>
          <DepthChart
            bids={product.bids}
            asks={product.asks}
            userOrder={userOrder}
            clearingPrice={clearingPrice}
          />
        </div>

        {/* Right column: ticket + results */}
        <div className="col-trade">
          <h3 className="col-title">Your Order</h3>
          <TradeTicket
            price={inputs.price}
            volume={inputs.volume}
            onPriceChange={v => onInputChange('price', v)}
            onVolumeChange={v => onInputChange('volume', v)}
            resaleValue={product.resaleValue}
            symbol={product.symbol}
          />
          <h3 className="col-title">Simulation Result</h3>
          {result ? (
            <ResultsPanel
              result={result}
              resaleValue={product.resaleValue}
              buyFee={product.buyFeePerUnit}
              sellFee={product.sellFeePerUnit}
            />
          ) : (
            <div className="no-result">Enter a valid price and volume above.</div>
          )}
        </div>
      </div>

      {/* Optimizer */}
      <div className="optimizer-section">
        <button className="optimizer-toggle" onClick={onToggleOptimizer}>
          {showOptimizer ? '▲ Hide optimizer' : '▼ Show optimizer'}
        </button>
        {showOptimizer && <OptimizerPanel product={product} />}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [flaxInputs, setFlaxInputs] = useState<OrderInputs>({ price: '29', volume: '5000' });
  const [mushInputs, setMushInputs] = useState<OrderInputs>({ price: '18', volume: '35000' });
  const [showFlaxOpt, setShowFlaxOpt] = useState(false);
  const [showMushOpt, setShowMushOpt] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  function updateFlax(field: 'price' | 'volume', value: string) {
    setFlaxInputs(prev => ({ ...prev, [field]: value }));
  }
  function updateMush(field: 'price' | 'volume', value: string) {
    setMushInputs(prev => ({ ...prev, [field]: value }));
  }

  // Summary PnL across both products
  const flaxOrder = useMemo(() => parseOrder(flaxInputs), [flaxInputs]);
  const mushOrder = useMemo(() => parseOrder(mushInputs), [mushInputs]);
  const flaxResult = useMemo(() => flaxOrder ? simulateAuction(DRYLAND_FLAX, flaxOrder) : null, [flaxOrder]);
  const mushResult = useMemo(() => mushOrder ? simulateAuction(EMBER_MUSHROOM, mushOrder) : null, [mushOrder]);
  const totalPnl = (flaxResult?.pnl ?? 0) + (mushResult?.pnl ?? 0);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Intarian Auction Simulator</h1>
          <span className="app-subtitle">An Intarian Welcome — Manual Round Practice</span>
        </div>
        <div className="header-right">
          <div className="total-pnl-box">
            <span className="total-pnl-label">Combined PnL</span>
            <span className={`total-pnl-value ${totalPnl > 0 ? 'pnl-pos' : totalPnl < 0 ? 'pnl-neg' : 'pnl-zero'}`}>
              {(totalPnl >= 0 ? '+' : '') + totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <button className="help-toggle" onClick={() => setShowHelp(h => !h)}>
            {showHelp ? 'Hide rules' : 'Show rules'}
          </button>
        </div>
      </header>

      {/* Rules/assumptions panel */}
      {showHelp && (
        <div className="help-panel">
          <h3>Simulator Assumptions</h3>
          <ul>
            <li><strong>Stale book:</strong> the displayed order books are fixed ("stale") — no new orders arrive before you submit.</li>
            <li><strong>One buy order per product:</strong> you submit a single limit buy order. Sell orders are not supported here.</li>
            <li><strong>Uniform-price call auction:</strong> a single clearing price is chosen to maximise total matched volume. Ties broken by higher price (per challenge rules).</li>
            <li><strong>Time priority:</strong> existing book orders have earlier time priority than your order. At your price level, book resting orders fill first. You are last in queue.</li>
            <li><strong>Immediate fixed resale:</strong> any inventory you receive is immediately sold to the Merchant Guild at the fixed resale price — no further trading.</li>
            <li><strong>Dryland Flax:</strong> resale 30 XIRECs, no fees. Net margin = 30 − clearing price per unit.</li>
            <li><strong>Ember Mushroom:</strong> resale 20 XIRECs, 0.05 buy fee + 0.05 sell fee = 0.10 total per unit. Net margin = 19.90 − clearing price per unit.</li>
          </ul>
        </div>
      )}

      {/* Product sections */}
      <main className="app-main">
        <ProductSection
          product={DRYLAND_FLAX}
          inputs={flaxInputs}
          onInputChange={updateFlax}
          showOptimizer={showFlaxOpt}
          onToggleOptimizer={() => setShowFlaxOpt(v => !v)}
        />
        <ProductSection
          product={EMBER_MUSHROOM}
          inputs={mushInputs}
          onInputChange={updateMush}
          showOptimizer={showMushOpt}
          onToggleOptimizer={() => setShowMushOpt(v => !v)}
        />
      </main>
    </div>
  );
}
