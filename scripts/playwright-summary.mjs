#!/usr/bin/env node
/**
 * Read the Playwright JSON report and write a Markdown summary to
 * $GITHUB_STEP_SUMMARY (or stdout when run locally).
 *
 * Usage:
 *   node scripts/playwright-summary.mjs [path/to/results.json]
 *
 * Defaults to playwright-report/results.json. Exits 0 even when tests
 * failed — the summary step should not mask the test step's exit code.
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';

const reportPath = process.argv[2] ?? 'playwright-report/results.json';
const outPath = process.env.GITHUB_STEP_SUMMARY;

if (!existsSync(reportPath)) {
  const msg = `No Playwright JSON report at ${reportPath}; skipping summary.`;
  console.warn(msg);
  if (outPath) appendFileSync(outPath, `### Playwright\n\n${msg}\n`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const stats = report.stats ?? {};
const durationSec = Math.round(((stats.duration ?? 0) / 1000) * 10) / 10;

const failures = [];
const flaky = [];

const walkSuite = (suite, trail = []) => {
  const title = suite.title ? [...trail, suite.title] : trail;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const status = test.status; // 'expected' | 'unexpected' | 'flaky' | 'skipped'
      if (status === 'unexpected' || status === 'flaky') {
        const file = spec.file ?? suite.file ?? '';
        const line = spec.line ?? '';
        const fullTitle = [...title, spec.title].filter(Boolean).join(' › ');
        const lastResult = test.results?.[test.results.length - 1];
        const failingResult = test.results?.find((r) => (r.errors?.length ?? 0) > 0 || r.error) ?? lastResult;
        const firstError = failingResult?.errors?.[0]?.message ?? failingResult?.error?.message ?? '';
        const oneLine = firstError.split('\n')[0].slice(0, 240);
        const entry = { file, line, fullTitle, oneLine, retries: test.results?.length ?? 0 };
        (status === 'flaky' ? flaky : failures).push(entry);
      }
    }
  }
  for (const child of suite.suites ?? []) walkSuite(child, title);
};
for (const suite of report.suites ?? []) walkSuite(suite);

const totals = {
  expected: stats.expected ?? 0,
  unexpected: stats.unexpected ?? 0,
  flaky: stats.flaky ?? 0,
  skipped: stats.skipped ?? 0,
};
const allPassed = totals.unexpected === 0;
const emoji = allPassed ? (totals.flaky ? '⚠️' : '✅') : '❌';

const lines = [];
lines.push(`## ${emoji} Playwright E2E results`);
lines.push('');
lines.push('| Passed | Failed | Flaky | Skipped | Duration |');
lines.push('| ---: | ---: | ---: | ---: | ---: |');
lines.push(
  `| ${totals.expected} | ${totals.unexpected} | ${totals.flaky} | ${totals.skipped} | ${durationSec}s |`,
);
lines.push('');

const renderList = (label, items) => {
  if (items.length === 0) return;
  lines.push(`### ${label} (${items.length})`);
  lines.push('');
  for (const f of items) {
    const loc = f.file ? ` — \`${f.file}${f.line ? `:${f.line}` : ''}\`` : '';
    lines.push(`- **${f.fullTitle}**${loc}`);
    if (f.oneLine) lines.push(`  - \`${f.oneLine.replace(/`/g, "'")}\``);
  }
  lines.push('');
};
renderList('Failures', failures);
renderList('Flaky', flaky);

if (allPassed && totals.flaky === 0) {
  lines.push('_All tests passed._');
  lines.push('');
}
lines.push(
  '_Full HTML report is uploaded as the `playwright-report` artifact._',
);

const md = lines.join('\n') + '\n';
if (outPath) {
  appendFileSync(outPath, md);
  console.log(`Wrote Playwright summary (${md.length} bytes) to $GITHUB_STEP_SUMMARY`);
} else {
  process.stdout.write(md);
}
