import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Load the actual TypeScript modules, without a second implementation of the parser.
function load(name, dependencies = {}) {
  const source = readFileSync(
    new URL(`../src/${name}.ts`, import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((id) => {
    if (!dependencies[id]) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  }, exports);
  return exports;
}
const tracker = load("vintedTracker");
const inventory = load("inventory", { "./vintedTracker": tracker });
const header = ",ARTICOLO,ACQUISTO,€,shop,VENDITA,€";

test("fresh inventory starts empty with the predefined columns only", () => {
  const empty = inventory.createEmptyInventory();
  assert.equal(empty.items.length, 0);
  assert.equal(empty.fields.length, 7);
  assert.equal(empty.fields[1].label, "Articolo");
});

test("legacy purchase/shop/sale columns remain separate and missing dates do not lose prices", () => {
  const data = tracker.parseVintedCsv(
    `${header}\n1,Hoodie,10/19/2025,13 €,1/24/2026,25/08/26,14 €\n1,No dates,,8 €,,,20 €\n1,Free item,,,,1/8/2026,32 €`,
  );
  assert.equal(data.transactions.length, 3);
  assert.equal(data.transactions[0].saleDate.monthKey, "2026-08");
  assert.equal(data.transactions[0].purchasePrice, 13);
  assert.equal(data.summary.totalSpend, 21);
  assert.equal(data.summary.totalRevenue, 66);
  assert.equal(data.transactions[2].profit, 32);
});

test("date parser accepts ISO, US legacy, Italian short year, malformed legacy separators", () => {
  assert.equal(tracker.parseDate("2026-02-08").monthKey, "2026-02");
  assert.equal(tracker.parseDate("2/8/2026").day, 8);
  assert.equal(tracker.parseDate("08/02/26").day, 8);
  assert.equal(tracker.parseDate("26/11(25").monthKey, "2025-11");
  assert.equal(tracker.parseDate("2026-02-30"), null);
  assert.equal(tracker.parseDate("8/4/1935").plausible, false);
});

test("money parser does not classify dates as currency and supports both separator conventions", () => {
  assert.equal(tracker.parseMoney("1/24/2026"), null);
  assert.equal(tracker.parseMoney("1,994.50 €"), 1994.5);
  assert.equal(tracker.parseMoney("1.994,50 €"), 1994.5);
  assert.equal(tracker.parseMoney("0 €"), 0);
});

test("CSV round-trip preserves all items, quotes, newlines, custom values and empty dates", () => {
  const source = inventory.importInventory(
    `${header}\n1,"Hoodie ""Blue""",,10 €,,,\n1,Windbraker,13/08/26,2 €,,,\n1,Windbraker,13/08/26,2 €,,,\n3,AGOSTO,spese AGOSTO,14 €,,guadagno AGOSTO,0 €`,
  );
  assert.equal(source.items.length, 3);
  source.fields.push({
    id: "notes",
    label: "Note, personali",
    type: "text",
    custom: true,
  });
  source.items[0].values.notes = 'Prima riga\n"seconda", riga';
  const restored = inventory.importInventory(inventory.exportInventory(source));
  assert.equal(restored.items.length, 3);
  assert.equal(restored.items[0].values.name, 'Hoodie "Blue"');
  assert.equal(
    restored.items[0].values[restored.fields.at(-1).id],
    source.items[0].values.notes,
  );
  assert.equal(restored.items[0].values.purchaseDate, "");
});

test("metrics follow live edits and exclude invalid years from days to sell", () => {
  const source = inventory.importInventory(
    `${header}\n1,Old,8/4/1935,10 €,,9/29/2025,37 €\n1,New,2026-01-01,10 €,,2026-01-11,20 €`,
  );
  assert.equal(inventory.datasetFor(source).summary.averageDaysToSell, 10);
  source.items[1].values.salePrice = "30";
  assert.equal(inventory.datasetFor(source).summary.totalRevenue, 67);
  source.items.pop();
  assert.equal(inventory.datasetFor(source).summary.totalItems, 1);
});
