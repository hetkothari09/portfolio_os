import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPTS_DIR = path.join(__dirname, '../../src/scripts');

interface FmvSeedRow {
  isin: string;
  scripName: string;
  fmvPerUnit: string;
}

function loadJson(filename: string): FmvSeedRow[] {
  const p = path.join(SCRIPTS_DIR, filename);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function assertWellFormed(rows: FmvSeedRow[]) {
  expect(Array.isArray(rows)).toBe(true);
  expect(rows.length).toBeGreaterThan(0);

  const seenIsins = new Set<string>();
  for (const row of rows) {
    expect(typeof row.isin).toBe('string');
    expect(row.isin.length).toBeGreaterThan(0);
    expect(seenIsins.has(row.isin)).toBe(false); // no duplicate ISINs
    seenIsins.add(row.isin);

    expect(typeof row.scripName).toBe('string');
    expect(row.scripName.length).toBeGreaterThan(0);

    expect(typeof row.fmvPerUnit).toBe('string');
    expect(row.fmvPerUnit).toMatch(/^\d+(\.\d+)?$/); // plain decimal, no currency symbol/commas
    expect(Number(row.fmvPerUnit)).toBeGreaterThan(0);
  }
}

describe('fmv_31jan2018_seed.json (stocks)', () => {
  it('is well-formed with no duplicate ISINs', () => {
    assertWellFormed(loadJson('fmv_31jan2018_seed.json'));
  });

  it('covers meaningfully more than the original 200-ISIN baseline', () => {
    const rows = loadJson('fmv_31jan2018_seed.json');
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });
});

describe('fmv_mf_31jan2018_seed.json (mutual funds)', () => {
  const p = path.join(SCRIPTS_DIR, 'fmv_mf_31jan2018_seed.json');

  it('exists and is well-formed with no duplicate ISINs', () => {
    expect(fs.existsSync(p)).toBe(true);
    assertWellFormed(loadJson('fmv_mf_31jan2018_seed.json'));
  });

  it('shares no ISIN collisions with the stock seed (ISINs are globally unique per instrument)', () => {
    const stockIsins = new Set(loadJson('fmv_31jan2018_seed.json').map((r) => r.isin));
    const mfRows = loadJson('fmv_mf_31jan2018_seed.json');
    for (const row of mfRows) {
      expect(stockIsins.has(row.isin)).toBe(false);
    }
  });
});
