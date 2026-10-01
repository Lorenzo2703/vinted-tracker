import { formatEuro, formatDays, formatPercent, type VintedDataset } from './vintedTracker'

export default function Analytics({ dataset }: { dataset: VintedDataset }) {
  const { summary, monthlyMetrics, categoryMetrics } = dataset
  const max = Math.max(1, ...monthlyMetrics.flatMap((month) => [month.spend, month.revenue]))
  const categories = categoryMetrics.slice(0, 8)
  const categoryMax = Math.max(1, ...categories.map((category) => category.revenue))
  const best = [...dataset.transactions].filter((item) => item.profit !== null).sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)).slice(0, 5)
  return <div className="analytics">
    <div className="page-heading"><div><p className="eyebrow">IL TUO BUSINESS, IN NUMERI</p><h1>Metriche & grafici</h1><p>Si aggiornano automaticamente quando modifichi l’inventario.</p></div><span className="live-badge">● Dati aggiornati</span></div>
    <section className="metrics-grid" aria-label="Metriche principali">
      {[
        ['Spesa totale', formatEuro(summary.totalSpend), 'Tutti gli acquisti'],
        ['Ricavi', formatEuro(summary.totalRevenue), `${summary.soldItems} articoli venduti`],
        ['Saldo di cassa', formatEuro(summary.totalProfit), 'Ricavi − tutti gli acquisti'],
        ['Sell-through', formatPercent(summary.sellThroughRate), `${summary.openItems} articoli in stock`],
        ['Margine medio', formatEuro(summary.averageMargin), 'Per articolo venduto; costi mancanti = 0'],
        ['Tempo di vendita', formatDays(summary.averageDaysToSell), 'Escluse date anomale e intervalli negativi'],
      ].map(([label, value, hint]) => <article className="metric-card" key={label}><p>{label}</p><strong>{value}</strong><small>{hint}</small></article>)}
    </section>
    <div className="chart-layout">
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">ANDAMENTO</p><h2>Acquisti e vendite</h2></div><div className="legend"><span>● Ricavi</span><span>● Spesa</span></div></div>
        {monthlyMetrics.length ? <div className="chart-scroll" tabIndex={0} aria-label="Scorri il grafico mensile"><svg className="monthly-chart" style={{ minWidth: Math.max(640, monthlyMetrics.length * 68) }} viewBox={`0 0 ${Math.max(640, monthlyMetrics.length * 68)} 290`} role="img" aria-label="Ricavi e spese mensili in euro">
          {[0, 1, 2, 3, 4].map((tick) => <g key={tick}><line x1="48" x2="100%" y1={20 + tick * 50} y2={20 + tick * 50} className="grid-line"/><text x="0" y={24 + tick * 50} className="axis-label">{Math.round(max * (1 - tick / 4))} €</text></g>)}
          {monthlyMetrics.map((month, index) => {
            const x = 60 + index * ((Math.max(640, monthlyMetrics.length * 68) - 60) / monthlyMetrics.length)
            return <g key={month.monthKey}>
              <rect x={x} y={220 - month.revenue / max * 200} width="16" height={month.revenue / max * 200} rx="4" fill="#24b7a5"><title>{month.label}: ricavi {formatEuro(month.revenue)}</title></rect>
              <rect x={x + 20} y={220 - month.spend / max * 200} width="16" height={month.spend / max * 200} rx="4" fill="#9badd2"><title>{month.label}: spesa {formatEuro(month.spend)}</title></rect>
              <text x={x + 18} y="247" textAnchor="middle" className="axis-label">{month.label.split(' ')[0]}</text><text x={x + 18} y="264" textAnchor="middle" className="axis-label">{month.monthKey.slice(0, 4)}</text>
            </g>
          })}
        </svg></div> : <p className="empty">Aggiungi delle transazioni per vedere il grafico.</p>}
        <p className="note">Acquisti per data di acquisto, ricavi per data di vendita. Le date mancanti o anomale non entrano nella timeline.</p>
      </section>
      <section className="panel"><p className="eyebrow">CATEGORIE</p><h2>Da dove arrivano i ricavi</h2><div className="category-bars">{categories.map((category) => <div key={category.label}><div className="category-head"><strong>{category.label}</strong><span>{formatEuro(category.revenue)}</span></div><div className="category-track"><span style={{ width: `${category.revenue / categoryMax * 100}%` }}/></div><small>{category.count} articoli</small></div>)}</div></section>
    </div>
    <section className="panel"><p className="eyebrow">IN EVIDENZA</p><h2>I migliori margini</h2><div className="best-items">{best.map((item) => <div key={item.id}><span>{item.name}</span><strong className="positive">{formatEuro(item.profit ?? 0)}</strong></div>)}</div><p className="note">{summary.suspiciousDates} date fuori intervallo rilevate. I costi di acquisto non indicati sono considerati 0 nei margini: completa i dati per risultati più precisi.</p></section>
  </div>
}