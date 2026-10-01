export type VintedTransaction = {
    id: string
    name: string
    quantity: number | null
    purchaseDate: ParsedDate | null
    purchasePrice: number | null
    saleDate: ParsedDate | null
    salePrice: number | null
    profit: number | null
    sourceRow: string[]
}

export type ParsedDate = {
    raw: string
    date: Date
    year: number
    month: number
    day: number
    monthKey: string
    display: string
    plausible: boolean
}

export type MonthlyMetric = {
    monthKey: string
    label: string
    spend: number
    revenue: number
    profit: number
    soldCount: number
    purchaseCount: number
}

export type CategoryMetric = {
    label: string
    count: number
    spend: number
    revenue: number
    profit: number
}

export type VintedDataset = {
    transactions: VintedTransaction[]
    monthlyMetrics: MonthlyMetric[]
    categoryMetrics: CategoryMetric[]
    summary: {
        totalItems: number
        purchasedItems: number
        soldItems: number
        openItems: number
        totalSpend: number
        totalRevenue: number
        totalProfit: number
        sellThroughRate: number
        averageMargin: number
        averageDaysToSell: number | null
        suspiciousDates: number
    }
}

const euroFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
})

const monthFormatter = new Intl.DateTimeFormat('it-IT', {
    month: 'short',
    year: 'numeric',
})

const currentYear = new Date().getFullYear()

const knownCategories = [
    'Crewneck',
    'Hoodie',
    'Giacca',
    'Giacchetto',
    'Cappotto',
    'Maglione',
    'T-shirt',
    'Tshirt',
    'T shirt',
    'Camicia',
    'Pantaloni',
    'Jeans',
    'Sneakers',
    'Polo',
    'Felpa',
    'Tuta',
    'Windbraker',
    'Overshirt',
    'Cardigan',
    'Pile',
    'Bermuda',
    'Zaino',
    'Zainetto',
    'Maglietta',
    'Occhiali',
    'Cappellino',
    'Cappello',
    'Giubbotto',
    'Maglia',
    'Sweater',
    'Trench',
    'Parka',
    'Smanicato',
    'Smock',
]

export function parseVintedCsv(csvText: string): VintedDataset {
    const rows = parseCsvRows(csvText)
    const transactions: VintedTransaction[] = []

    rows.forEach((row, index) => {
        const transaction = parseTransactionRow(row, index)
        if (transaction) {
            transactions.push(transaction)
        }
    })

    const monthlyMap = new Map<string, MonthlyMetric>()
    const categoryMap = new Map<string, CategoryMetric>()
    let suspiciousDates = 0

    let soldDurationTotal = 0
    let soldDurationCount = 0

    transactions.forEach((transaction) => {
        const purchaseDate = transaction.purchaseDate
        const saleDate = transaction.saleDate
        const purchasePrice = transaction.purchasePrice ?? 0
        const salePrice = transaction.salePrice ?? 0
        const profit = transaction.profit ?? 0

        if (purchaseDate?.plausible) {
            const month = ensureMonthlyMetric(monthlyMap, purchaseDate)
            month.spend += purchasePrice
            month.purchaseCount += 1
        }

        if (saleDate?.plausible && transaction.salePrice !== null) {
            const month = ensureMonthlyMetric(monthlyMap, saleDate)
            month.revenue += salePrice
            month.profit += profit
            month.soldCount += 1
        }

        if (purchaseDate && !purchaseDate.plausible) {
            suspiciousDates += 1
        }
        if (saleDate && !saleDate.plausible) {
            suspiciousDates += 1
        }

        const category = extractCategory(transaction.name)
        const categoryMetric = categoryMap.get(category) ?? {
            label: category,
            count: 0,
            spend: 0,
            revenue: 0,
            profit: 0,
        }
        categoryMetric.count += 1
        categoryMetric.spend += purchasePrice
        categoryMetric.revenue += salePrice
        categoryMetric.profit += profit
        categoryMap.set(category, categoryMetric)

        if (purchaseDate?.plausible && saleDate?.plausible && transaction.salePrice !== null) {
            const diffMs = saleDate.date.getTime() - purchaseDate.date.getTime()
            if (Number.isFinite(diffMs) && diffMs >= 0) {
                soldDurationTotal += diffMs
                soldDurationCount += 1
            }
        }
    })

    const totalSpend = transactions.reduce((sum, transaction) => sum + (transaction.purchasePrice ?? 0), 0)
    const totalRevenue = transactions.reduce((sum, transaction) => sum + (transaction.salePrice ?? 0), 0)
    const totalProfit = totalRevenue - totalSpend
    const purchasedItems = transactions.filter((transaction) => transaction.purchasePrice !== null).length
    const soldItems = transactions.filter((transaction) => transaction.salePrice !== null).length
    const openItems = transactions.length - soldItems
    const averageMargin = soldItems > 0 ? transactions.reduce((sum, item) => sum + (item.profit ?? 0), 0) / soldItems : 0
    const sellThroughRate = transactions.length > 0 ? soldItems / transactions.length : 0
    const averageDaysToSell = soldDurationCount > 0 ? soldDurationTotal / soldDurationCount / 86_400_000 : null

    const monthlyMetrics = [...monthlyMap.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    const categoryMetrics = [...categoryMap.values()].sort((left, right) => {
        if (right.revenue !== left.revenue) {
            return right.revenue - left.revenue
        }

        return right.count - left.count
    })

    return {
        transactions,
        monthlyMetrics,
        categoryMetrics,
        summary: {
            totalItems: transactions.length,
            purchasedItems,
            soldItems,
            openItems,
            totalSpend,
            totalRevenue,
            totalProfit,
            sellThroughRate,
            averageMargin,
            averageDaysToSell,
            suspiciousDates,
        },
    }
}

export function formatEuro(value: number): string {
    return euroFormatter.format(value)
}

export function formatPercent(value: number): string {
    return new Intl.NumberFormat('it-IT', {
        style: 'percent',
        maximumFractionDigits: 1,
    }).format(value)
}

export function formatDays(value: number | null): string {
    if (value === null) {
        return 'n/a'
    }

    return `${value.toFixed(1)} giorni`
}

export function formatMonthLabel(monthKey: string): string {
    const [yearPart, monthPart] = monthKey.split('-')
    const year = Number(yearPart)
    const month = Number(monthPart)
    const date = new Date(Date.UTC(year, month - 1, 1))

    return monthFormatter.format(date)
}

function parseTransactionRow(row: string[], index: number): VintedTransaction | null {
    if (row.length < 2) {
        return null
    }

    const quantity = parseNumber(row[0])
    const name = row[1]?.trim()

    if (!name) {
        return null
    }

    if (isSummaryRow(row)) {
        return null
    }

    if (name.toUpperCase() === 'ARTICOLO') return null
    const purchaseDate = parseDate(row[2] ?? '')
    const purchasePrice = parseMoney(row[3] ?? '')
    const saleDate = parseDate(row[5] ?? '')
    const salePrice = parseMoney(row[6] ?? '')
    const profit = salePrice !== null ? salePrice - (purchasePrice ?? 0) : null

    return {
        id: `${index}-${name}`,
        name,
        quantity,
        purchaseDate,
        purchasePrice,
        saleDate,
        salePrice,
        profit,
        sourceRow: row,
    }
}

export function parseCsvRows(csvText: string): string[][] {
    const rows: string[][] = []
    const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '')
    const delimiter = normalizedText.split('\n')[0].includes(';') ? ';' : ','
    let currentCell = ''
    let currentRow: string[] = []
    let inQuotes = false

    for (let index = 0; index < normalizedText.length; index += 1) {
        const char = normalizedText[index]
        const next = normalizedText[index + 1]

        if (char === '"') {
            if (inQuotes && next === '"') {
                currentCell += '"'
                index += 1
            } else {
                inQuotes = !inQuotes
            }
            continue
        }

        if (char === delimiter && !inQuotes) {
            currentRow.push(currentCell)
            currentCell = ''
            continue
        }

        if (char === '\n' && !inQuotes) {
            currentRow.push(currentCell)
            rows.push(currentRow)
            currentRow = []
            currentCell = ''
            continue
        }

        currentCell += char
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell)
        rows.push(currentRow)
    }

    return rows
        .map((row) => row.map((cell) => cell.trim()))
        .filter((row) => row.some((cell) => cell.length > 0))
}

function parseNumber(value: string): number | null {
    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    const parsed = Number(trimmed.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
}

export function parseMoney(value: string): number | null {
    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    if (trimmed.includes('/') || /[a-zA-Z]/.test(trimmed)) {
        return null
    }

    const cleaned = trimmed.replace(/[^\d,.-]/g, '')
    if (!cleaned) {
        return null
    }

    const hasComma = cleaned.includes(',')
    const hasDot = cleaned.includes('.')
    let normalized = cleaned

    if (hasComma && hasDot) {
        normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
            ? cleaned.replace(/\./g, '').replace(',', '.')
            : cleaned.replace(/,/g, '')
    } else if (hasComma) {
        const commaParts = cleaned.split(',')
        if (commaParts.length === 2 && commaParts[1].length <= 2) {
            normalized = `${commaParts[0]}.${commaParts[1]}`
        } else {
            normalized = cleaned.replace(/,/g, '')
        }
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

export function parseDate(value: string): ParsedDate | null {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const match = value
        .replace(/[()]/g, '/')
        .match(/(\d{1,2})[/ -](\d{1,2})(?:[/ -](\d{2,4}))?/)

    if (!match && !iso) {
        return null
    }

    const first = Number(iso ? iso[2] : match![1])
    const second = Number(iso ? iso[3] : match![2])
    const yearPart = iso ? iso[1] : match![3]

    if (!yearPart) {
        return null
    }

    const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart)
    const useDayMonth = !iso && (first > 12 || yearPart.length === 2)
    const month = useDayMonth ? second : first
    const day = useDayMonth ? first : second
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null
    }

    return {
        raw: value.trim(),
        date,
        year,
        month,
        day,
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
        display: date.toLocaleDateString('it-IT'),
        plausible: year >= 2000 && year <= currentYear + 1,
    }
}

function ensureMonthlyMetric(monthlyMap: Map<string, MonthlyMetric>, parsedDate: ParsedDate): MonthlyMetric {
    const existing = monthlyMap.get(parsedDate.monthKey)
    if (existing) {
        return existing
    }

    const metric: MonthlyMetric = {
        monthKey: parsedDate.monthKey,
        label: formatMonthLabel(parsedDate.monthKey),
        spend: 0,
        revenue: 0,
        profit: 0,
        soldCount: 0,
        purchaseCount: 0,
    }

    monthlyMap.set(parsedDate.monthKey, metric)
    return metric
}

function extractCategory(name: string): string {
    const normalized = name
        .replace(/^"|"$/g, '')
        .replace(/^T[-\s]?shirt/i, 'T-shirt')
        .replace(/\s+/g, ' ')
        .trim()

    const directMatch = knownCategories.find((category) => normalized.toLowerCase().startsWith(category.toLowerCase()))
    if (directMatch) {
        return directMatch
    }

    return normalized.split(' ')[0] || 'Altro'
}

function isSummaryRow(row: string[]): boolean {
    const joined = row.join(' ').toLowerCase()
    return joined.includes('spese ') || joined.includes('guadagno ') || joined.includes('ricavo ')
}