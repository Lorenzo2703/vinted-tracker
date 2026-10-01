import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { datasetFor, exportInventory, importInventory, itemProfit, loadInventory, storageKey, type Field, type Inventory, type Item } from './inventory'
import { formatEuro, parseMoney } from './vintedTracker'
import Analytics from './Analytics'
import './App.css'

function Icon({ name }: { name: 'plus' | 'table' | 'chart' | 'upload' | 'download' | 'settings' | 'trash' | 'close' | 'search' | 'edit' }) {
  const paths = {
    plus: 'M12 5v14M5 12h14', table: 'M3 3h18v18H3zM3 9h18M9 9v12', chart: 'M4 4v16h17M8 16v-5M13 16V7M18 16V4',
    upload: 'M12 16V3M7 8l5-5 5 5M4 16v5h16v-5', download: 'M12 3v13M7 11l5 5 5-5M4 16v5h16v-5',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    close: 'M6 6l12 12M18 6L6 18', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', edit: 'M4 16v4h4L20 8l-4-4L4 16M13 7l4 4',
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className="modal" aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Chiudi"><Icon name="close"/></button></div>{children}
  </dialog>
}

export default function App() {
  const [inventory, setInventory] = useState(() => loadInventory())
  const [tab, setTab] = useState<'inventory' | 'analytics'>('inventory')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [editor, setEditor] = useState<Item | null>(null)
  const [showFields, setShowFields] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<Field['type']>('text')
  const [notice, setNotice] = useState('Dati conservati solo su questo dispositivo. Esporta un CSV per il backup.')
  const [saveError, setSaveError] = useState(false)
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; action: () => void } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dataset = useMemo(() => datasetFor(inventory), [inventory])
  const visibleFields = inventory.fields.filter((field) => !hidden.includes(field.id))
  const shown = inventory.items.filter((item) => {
    const sold = parseMoney(item.values.salePrice ?? '') !== null
    return (filter === 'all' || (filter === 'sold' ? sold : !sold))
      && Object.values(item.values).some((value) => value.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  })

  function commit(next: Inventory, message = 'Modifiche salvate su questo dispositivo.') {
    setInventory(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice(message); setSaveError(false) }
    catch { setNotice('Salvataggio locale non disponibile. Esporta subito un CSV per non perdere le modifiche.'); setSaveError(true) }
  }

  function updateCell(id: string, field: string, value: string) {
    commit({ ...inventory, items: inventory.items.map((item) => item.id === id ? { ...item, values: { ...item.values, [field]: value } } : item) })
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([exportInventory(inventory)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url; link.download = `vinted-inventario-${new Date().toISOString().slice(0, 10)}.csv`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('CSV esportato con tutti gli articoli e i campi personalizzati, anche quelli nascosti.')
  }

  async function importCsv(file: File) {
    try {
      const next = importInventory(await file.text())
      setConfirmation({ title: 'Importare il CSV?', message: `${next.items.length} articoli letti da ${file.name}. L’importazione sostituirà l’inventario e i campi attuali. Esporta prima un backup se necessario.`, action: () => { commit(next, `${next.items.length} articoli importati.`); setHidden([]); setSearch(''); setFilter('all') } })
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Impossibile leggere il file.'); setSaveError(true) }
  }

  function addField() {
    const label = fieldName.trim()
    if (!label || inventory.fields.some((field) => field.label.toLocaleLowerCase() === label.toLocaleLowerCase())) { setNotice('Scegli un nome di campo unico.'); return }
    commit({ ...inventory, fields: [...inventory.fields, { id: `custom-${crypto.randomUUID()}`, label, type: fieldType, custom: true }] })
    setFieldName('')
  }

  function renameField(id: string, label: string) {
    const name = label.trim()
    if (!name || inventory.fields.some((field) => field.id !== id && field.label.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setNotice('Il nome del campo deve essere unico e non vuoto.')
      return
    }
    commit({ ...inventory, fields: inventory.fields.map((field) => field.id === id ? { ...field, label: name } : field) })
  }

    return <div className="app-shell">
      <header className="app-header"><a href="#" className="brand" onClick={(event) => { event.preventDefault(); setTab('inventory') }}><span className="brand-mark">v.</span><span>vinted<span className="brand-light">tracker</span></span></a><div className="header-right"></div></header>
    <main>
      <nav className="tabs" aria-label="Sezioni"><button className={tab === 'inventory' ? 'active' : ''} aria-current={tab === 'inventory' ? 'page' : undefined} onClick={() => setTab('inventory')}><Icon name="table"/>Inventario<span>{inventory.items.length}</span></button><button className={tab === 'analytics' ? 'active' : ''} aria-current={tab === 'analytics' ? 'page' : undefined} onClick={() => setTab('analytics')}><Icon name="chart"/>Metriche & grafici</button></nav>
      <p className={`notice ${saveError ? 'error' : ''}`} role="status">{notice}</p>
      {tab === 'analytics' ? <Analytics dataset={dataset}/> : <>
        <section className="page-heading"><div><p className="eyebrow">TUTTO SOTTO CONTROLLO</p><h1>Il tuo inventario</h1><p>Ogni articolo, dall’acquisto alla prossima vendita.</p></div><button className="button primary" onClick={() => setEditor({ id: crypto.randomUUID(), values: { quantity: '1', name: '' } })}><Icon name="plus"/>Nuovo articolo</button></section>
        <div className="inventory-summary"><span><strong>{inventory.items.length}</strong> articoli totali</span><span><i className="dot teal"/><strong>{dataset.summary.soldItems}</strong> venduti</span><span><i className="dot amber"/><strong>{dataset.summary.openItems}</strong> in stock</span><span className="summary-revenue">Ricavi <strong>{formatEuro(dataset.summary.totalRevenue)}</strong></span></div>
        <section className="inventory-panel" aria-label="Inventario articoli">
          <div className="table-toolbar"><div className="search-input"><Icon name="search"/><input aria-label="Cerca articoli" placeholder="Cerca un articolo, una marca…" value={search} onChange={(event) => setSearch(event.target.value)}/></div><select aria-label="Filtra per stato" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Tutti gli stati</option><option value="open">In stock</option><option value="sold">Venduti</option></select><div className="toolbar-actions"><button className="button subtle" onClick={() => setShowFields(true)}><Icon name="settings"/>Campi</button><button className="button subtle" onClick={() => fileRef.current?.click()}><Icon name="upload"/>Importa CSV</button><button className="button subtle" onClick={exportCsv}><Icon name="download"/>Esporta CSV</button></div></div>
          <input hidden ref={fileRef} type="file" accept=".csv,text/csv" aria-label="Carica CSV" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); event.target.value = '' }}/>
          <div className="table-scroll" tabIndex={0} aria-label="Tabella inventario, scorri per vedere tutti i campi"><table><thead><tr>{visibleFields.map((field) => <th key={field.id}>{field.label}</th>)}<th>Margine</th><th>Stato</th><th className="actions-cell">Azioni</th></tr></thead><tbody>
            {shown.map((item) => { const profit = itemProfit(item); return <tr key={item.id}>{visibleFields.map((field) => <td key={field.id} className={field.id === 'name' ? 'name-cell' : ''}><EditableCell value={item.values[field.id] ?? ''} field={field} itemName={item.values.name} onSave={(value) => updateCell(item.id, field.id, value)}/></td>)}<td className={profit !== null && profit < 0 ? 'negative' : 'positive'}>{profit === null ? '—' : formatEuro(profit)}</td><td><span className={`status-chip ${profit === null ? 'open' : 'sold'}`}>{profit === null ? 'In stock' : 'Venduto'}</span></td><td className="actions-cell"><div><button className="icon-button" aria-label={`Modifica ${item.values.name}`} onClick={() => setEditor({ ...item, values: { ...item.values } })}><Icon name="edit"/></button><button className="icon-button danger" aria-label={`Elimina ${item.values.name}`} onClick={() => setConfirmation({ title: 'Eliminare l’articolo?', message: item.values.name, action: () => commit({ ...inventory, items: inventory.items.filter((row) => row.id !== item.id) }) })}><Icon name="trash"/></button></div></td></tr> })}
          </tbody></table>{!shown.length && <div className="empty"><h2>Nessun articolo trovato</h2><p>Aggiungi un articolo oppure modifica i filtri di ricerca.</p></div>}</div>
          <footer className="table-footer"><span>{shown.length} di {inventory.items.length} articoli</span><span>Clicca una cella per modificarla · Invio salva · Esc annulla</span></footer>
        </section>
      </>}
    </main>
    {editor && <Modal title={inventory.items.some((item) => item.id === editor.id) ? 'Modifica articolo' : 'Nuovo articolo'} onClose={() => setEditor(null)}><form onSubmit={(event) => { event.preventDefault(); const next = { ...editor, values: { ...editor.values, name: editor.values.name.trim() } }; if (!next.values.name) return; commit({ ...inventory, items: inventory.items.some((item) => item.id === editor.id) ? inventory.items.map((item) => item.id === editor.id ? next : item) : [next, ...inventory.items] }); setEditor(null) }}><p className="note">Usa i campi predefiniti e quelli personalizzati. Aggiungi nuove colonne dal pulsante Campi.</p><div className="form-grid">{inventory.fields.map((field) => <label key={field.id} className={field.id === 'name' ? 'full-width' : ''}>{field.label}{field.custom && <small>Personalizzato</small>}<input autoFocus={field.id === 'name'} required={field.id === 'name'} value={editor.values[field.id] ?? ''} inputMode={field.type === 'number' ? 'decimal' : undefined} placeholder={field.type === 'date' ? 'AAAA-MM-GG o data originale CSV' : field.type === 'number' ? '0,00' : ''} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, [field.id]: event.target.value } })}/></label>)}</div><div className="modal-actions"><button className="button subtle" type="button" onClick={() => setEditor(null)}>Annulla</button><button className="button primary" type="submit">Salva articolo</button></div></form></Modal>}
    {showFields && <Modal title="Gestisci i campi" onClose={() => setShowFields(false)}><p className="note">Mostra o nascondi le colonne. I campi predefiniti restano nei dati e nell’export; puoi rinominare o eliminare i campi personalizzati.</p><div className="field-list">{inventory.fields.map((field) => <div className="field-row" key={field.id}><label><input type="checkbox" checked={!hidden.includes(field.id)} onChange={() => setHidden(hidden.includes(field.id) ? hidden.filter((id) => id !== field.id) : [...hidden, field.id])}/>{field.label}<small>{field.custom ? field.type : 'Predefinito'}</small></label>{field.custom && <><input className="field-rename" aria-label={`Rinomina campo ${field.label}`} key={field.label} defaultValue={field.label} onBlur={(event) => { if (event.target.value !== field.label) renameField(field.id, event.target.value) }}/><button className="icon-button danger" aria-label={`Elimina campo ${field.label}`} onClick={() => setConfirmation({ title: 'Eliminare il campo?', message: `“${field.label}” e tutti i suoi valori saranno rimossi.`, action: () => { commit({ ...inventory, fields: inventory.fields.filter((column) => column.id !== field.id), items: inventory.items.map((item) => ({ ...item, values: Object.fromEntries(Object.entries(item.values).filter(([id]) => id !== field.id)) })) }); setHidden(hidden.filter((id) => id !== field.id)) } })}><Icon name="trash"/></button></>}</div>)}</div><form className="new-field" onSubmit={(event) => { event.preventDefault(); addField() }}><h3>Aggiungi un campo personalizzato</h3><label>Nome del campo<input required placeholder="Es. Marca, taglia, note…" value={fieldName} onChange={(event) => setFieldName(event.target.value)}/></label><label>Tipo<select value={fieldType} onChange={(event) => setFieldType(event.target.value as Field['type'])}><option value="text">Testo</option><option value="number">Numero</option><option value="date">Data</option></select></label><button className="button primary" type="submit"><Icon name="plus"/>Aggiungi campo</button></form></Modal>}
    {confirmation && <Modal title={confirmation.title} onClose={() => setConfirmation(null)}><p>{confirmation.message}</p><div className="modal-actions"><button className="button subtle" onClick={() => setConfirmation(null)}>Annulla</button><button className="button primary" onClick={() => { confirmation.action(); setConfirmation(null) }}>Conferma</button></div></Modal>}
  </div>
}

function EditableCell({ value, field, itemName, onSave }: { value: string; field: Field; itemName: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  function save() { if (field.id === 'name' && !draft.trim()) return; onSave(draft); setEditing(false) }
  if (editing) return <input className="cell-input" autoFocus aria-label={`Modifica ${field.label} di ${itemName}`} value={draft} required={field.id === 'name'} inputMode={field.type === 'number' ? 'decimal' : undefined} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); save() } if (event.key === 'Escape') { event.preventDefault(); setEditing(false) } }}/>
  const money = field.id === 'purchasePrice' || field.id === 'salePrice'
  const parsed = money ? parseMoney(value) : null
  return <button className={`cell-button ${!value ? 'blank' : ''}`} aria-label={`${field.label} di ${itemName}: ${value || 'vuoto'}`} onClick={() => { setDraft(value); setEditing(true) }}>{money && parsed !== null ? formatEuro(parsed) : value || '—'}</button>
}