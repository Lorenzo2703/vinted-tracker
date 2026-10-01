import { parseCsvRows, parseMoney, parseVintedCsv } from './vintedTracker'

export type Field = { id: string; label: string; type: 'text' | 'number' | 'date'; custom?: boolean }
export type Item = { id: string; values: Record<string, string> }
export type Inventory = { version: 1; fields: Field[]; items: Item[] }
export const storageKey = 'vinted-inventory-v2'
export const baseFields: Field[] = [
    { id: 'quantity', label: 'Quantità', type: 'number' },
    { id: 'name', label: 'Articolo', type: 'text' },
    { id: 'purchaseDate', label: 'Data acquisto', type: 'date' },
    { id: 'purchasePrice', label: 'Costo acquisto', type: 'number' },
    { id: 'shop', label: 'Shop / pubblicazione', type: 'text' },
    { id: 'saleDate', label: 'Data vendita', type: 'date' },
    { id: 'salePrice', label: 'Prezzo vendita', type: 'number' },
]

export function createEmptyInventory(): Inventory {
    return { version: 1, fields: baseFields.map((field) => ({ ...field })), items: [] }
}

export function importInventory(csv: string): Inventory {
    const rows = parseCsvRows(csv)
    const headerIndex = rows.findIndex((row) => row[1]?.trim().toUpperCase() === 'ARTICOLO')
    if (headerIndex < 0) throw new Error('CSV non riconosciuto: la seconda colonna deve essere ARTICOLO.')
    const header = rows[headerIndex]
    const fields = baseFields.map((field) => ({ ...field }))
    const extraColumns: { index: number; field: Field }[] = []
    header.slice(7).forEach((label, offset) => {
        if (!label.trim()) return
        const field: Field = { id: `custom-${crypto.randomUUID()}`, label: label.trim(), type: 'text', custom: true }
        fields.push(field)
        extraColumns.push({ index: offset + 7, field })
    })
    const items: Item[] = []
    rows.slice(headerIndex + 1).forEach((row) => {
        if (!row[1]?.trim() || row.some((cell) => /^(spese |guadagno |ricavo )/i.test(cell))) return
        const values: Record<string, string> = {}
        baseFields.forEach((field, index) => { values[field.id] = row[index] ?? '' })
        extraColumns.forEach(({ index, field }) => { values[field.id] = row[index] ?? '' })
        items.push({ id: crypto.randomUUID(), values })
    })
    if (!items.length) throw new Error('Il CSV non contiene articoli da importare.')
    return { version: 1, fields, items }
}

const csvHeader = ['QUANTITÀ', 'ARTICOLO', 'ACQUISTO', 'COSTO €', 'shop', 'VENDITA', 'PREZZO €']
function quote(value: string) { return `"${value.replace(/"/g, '""')}"` }

export function exportInventory(inventory: Inventory): string {
    const custom = inventory.fields.filter((field) => field.custom)
    const ids = [...baseFields.map((field) => field.id), ...custom.map((field) => field.id)]
    return '\uFEFF' + [
        [...csvHeader, ...custom.map((field) => field.label)].map(quote).join(','),
        ...inventory.items.map((item) => ids.map((id) => quote(item.values[id] ?? '')).join(',')),
    ].join('\r\n')
}

export function datasetFor(inventory: Inventory) {
    // Custom fields are not financial inputs; keep them out of the metric parser.
    return parseVintedCsv(exportInventory({ ...inventory, fields: baseFields }))
}

export function itemProfit(item: Item): number | null {
    const sale = parseMoney(item.values.salePrice ?? '')
    return sale === null ? null : sale - (parseMoney(item.values.purchasePrice ?? '') ?? 0)
}

export function loadInventory(): Inventory {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
        if (isInventory(stored)) return stored
    } catch { /* An unavailable or corrupt store falls back to a fresh inventory. */ }
    return createEmptyInventory()
}

function isInventory(value: unknown): value is Inventory {
    if (!value || typeof value !== 'object') return false
    const data = value as Partial<Inventory>
    return data.version === 1 && Array.isArray(data.fields) && Array.isArray(data.items)
        && baseFields.every((base) => data.fields!.some((field) => field.id === base.id))
        && data.fields.every((field) => typeof field.id === 'string' && typeof field.label === 'string'
            && ['text', 'number', 'date'].includes(field.type))
        && data.items.every((item) => typeof item.id === 'string' && item.values && typeof item.values === 'object'
            && Object.values(item.values).every((cell) => typeof cell === 'string'))
}