#!/usr/bin/env node
/**
 * Typprüfung gegen eine Basislinie.
 *
 * Warum nicht einfach `tsc --noEmit`:
 *   - Das Wurzel-tsconfig.json hat "files": [] und delegiert per Project
 *     References. Ohne --build prüft `tsc --noEmit` damit KEINE einzige Datei.
 *     Das Skript war jahrelang ein No-Op, CI meldete grün ohne zu prüfen.
 *   - Schaltet man es scharf, stehen sofort ~975 Altfehler im Weg und jeder PR
 *     ist rot. Damit wäre die Prüfung genauso wertlos, nur andersherum.
 *
 * Deshalb: echter tsc-Lauf, aber verglichen mit typecheck-baseline.json.
 * Neue Fehler lassen den Lauf fehlschlagen, bestehende nicht. Wer Altlasten
 * abbaut, aktualisiert die Basislinie mit `npm run typecheck:baseline` — die
 * Zahl darf nur sinken.
 *
 * Fehler werden ohne Zeilen- und Spaltennummer verglichen, damit das Verschieben
 * von Code keinen Fehlalarm auslöst.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repoRoot, 'typecheck-baseline.json');
const writeBaseline = process.argv.includes('--update-baseline');

function runTsc() {
  try {
    execFileSync(
      process.execPath,
      [join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.app.json', '--noEmit'],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return '';
  } catch (err) {
    // tsc beendet sich mit != 0, sobald es Fehler findet — das ist der Normalfall.
    return `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
}

/** "src/a.tsx(12,3): error TS2339: Foo" -> "src/a.tsx|TS2339|Foo" */
function parse(output) {
  const counts = new Map();
  for (const line of output.split(/\r?\n/)) {
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
    if (!m) continue;
    const key = `${m[1].replace(/\\/g, '/')}|${m[4]}|${m[5]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const current = parse(runTsc());
const total = [...current.values()].reduce((a, b) => a + b, 0);

if (writeBaseline) {
  const sorted = Object.fromEntries([...current.entries()].sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, `${JSON.stringify({ total, errors: sorted }, null, 2)}\n`);
  console.log(`Basislinie geschrieben: ${total} bekannte Fehler.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error('typecheck-baseline.json fehlt. Einmalig erzeugen mit: npm run typecheck:baseline');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const known = new Map(Object.entries(baseline.errors ?? {}));

const regressions = [];
for (const [key, count] of current) {
  const allowed = known.get(key) ?? 0;
  if (count > allowed) regressions.push({ key, count, allowed });
}

if (regressions.length > 0) {
  console.error(`\nNeue Typfehler (${regressions.length} Stelle(n)):\n`);
  for (const { key, count, allowed } of regressions) {
    const [file, code, message] = key.split('|');
    const suffix = allowed > 0 ? ` (bisher ${allowed}x, jetzt ${count}x)` : '';
    console.error(`  ${file}: ${code}: ${message}${suffix}`);
  }
  console.error(`\nGesamt ${total}, Basislinie ${baseline.total}.`);
  console.error('Beheben — oder, wenn der Fehler bewusst uebernommen wird: npm run typecheck:baseline\n');
  process.exit(1);
}

const fixed = baseline.total - total;
console.log(
  fixed > 0
    ? `Keine neuen Typfehler. ${total} verbleibend, ${fixed} weniger als die Basislinie (${baseline.total}).`
    : `Keine neuen Typfehler. ${total} verbleibend (Basislinie ${baseline.total}).`,
);

if (fixed > 0) {
  console.log('Basislinie kann nachgezogen werden: npm run typecheck:baseline');
}
