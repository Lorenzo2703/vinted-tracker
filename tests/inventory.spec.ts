import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const sampleCsv = [
  ',ARTICOLO,ACQUISTO,€,shop,VENDITA,€,Tag',
  '1,Hoodie sample,10/1/2025,12 €,shop-a,10/5/2025,20 €,Alpha',
  '1,Cap sample,10/2/2025,5 €,shop-b,,,Beta',
].join('\n')

test('inventory editing, custom fields, CSV export/import, persistence and deletion', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.getByRole('button', { name: 'Importa CSV', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'sample.csv', mimeType: 'text/csv', buffer: Buffer.from(sampleCsv) })
  await expect(page.getByRole('dialog')).toContainText('2 articoli')
  await page.getByRole('button', { name: 'Conferma', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await page.getByRole('button', { name: 'Campi', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome del campo' }).fill('Note test')
  await page.getByRole('button', { name: 'Aggiungi campo', exact: true }).click()
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click()
  await page.getByRole('button', { name: 'Nuovo articolo', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Articolo', exact: true }).fill('TEST articolo')
  await dialog.getByRole('textbox', { name: 'Costo acquisto' }).fill('12')
  await dialog.getByRole('textbox', { name: 'Prezzo vendita' }).fill('30')
  await dialog.getByRole('textbox', { name: 'Note test' }).fill('Note "speciali", con virgola')
  await dialog.getByRole('button', { name: 'Salva articolo' }).click()
  await page.getByRole('textbox', { name: 'Cerca articoli' }).fill('TEST articolo')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('18,00')
  await page.getByRole('button', { name: 'Prezzo vendita di TEST articolo: 30', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Modifica Prezzo vendita di TEST articolo' })
  await input.fill('35')
  await input.press('Enter')
  await expect(page.locator('tbody')).toContainText('23,00')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Esporta CSV', exact: true }).click()
  const download = await downloadPromise
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv).toContain('Note test')
  expect(csv).toContain('Note ""speciali"", con virgola')
  await page.reload()
  await page.getByRole('textbox', { name: 'Cerca articoli' }).fill('TEST articolo')
  await expect(page.locator('tbody')).toContainText('35,00')
  await page.getByRole('button', { name: 'Elimina TEST articolo', exact: true }).click()
  await page.getByRole('button', { name: 'Conferma', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByRole('dialog')).toContainText('3 articoli')
  await page.getByRole('button', { name: 'Conferma', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await page.getByRole('button', { name: 'Metriche & grafici', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Metriche & grafici' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Metriche principali' })).toContainText('Saldo di cassa')
})

test('mobile layout and production PWA reload offline', async ({ page, context }) => {
  page.on('console', (message) => { if (message.type() === 'error') console.log('Browser error:', message.text()) })
  page.on('pageerror', (error) => console.log('Page error:', error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Nuovo articolo', exact: true }).click()
  const dialog = page.getByRole('dialog')
  expect(await dialog.evaluate((element) => element.getBoundingClientRect().width < 390)).toBe(true)
  await dialog.getByRole('textbox', { name: 'Articolo', exact: true }).fill('Mobile item')
  await dialog.getByRole('button', { name: 'Salva articolo', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js')
    const worker = registration.installing || registration.waiting || registration.active
    if (worker && worker.state !== 'activated') {
      await new Promise<void>((resolve, reject) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve()
          if (worker.state === 'redundant') reject(new Error('Service worker installation failed'))
        })
      })
    }
  })
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15000 })
  const manifest = await page.request.get('/manifest.webmanifest')
  expect((await manifest.json()).display).toBe('standalone')
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0)
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await page.getByRole('button', { name: 'Metriche & grafici', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Metriche principali' })).toBeVisible()
  } finally { await context.setOffline(false) }
})