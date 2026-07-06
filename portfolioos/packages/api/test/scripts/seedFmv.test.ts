import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { seedFmv } from '../../src/scripts/seedFmv.js';

const SCRIPTS_DIR = path.join(__dirname, '../../src/scripts');

function rowCount(filename: string): number {
  const p = path.join(SCRIPTS_DIR, filename);
  if (!fs.existsSync(p)) return 0;
  return JSON.parse(fs.readFileSync(p, 'utf8')).length;
}

describe('seedFmv()', () => {
  it('upserts every row from both seed files into SystemFmvSeed and reports accurate counts', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const fakePrisma = { systemFmvSeed: { upsert } } as unknown as PrismaClient;

    const result = await seedFmv(fakePrisma);

    const expectedStockRows = rowCount('fmv_31jan2018_seed.json');
    const expectedMfRows = rowCount('fmv_mf_31jan2018_seed.json');

    expect(result.stockRows).toBe(expectedStockRows);
    expect(result.mfRows).toBe(expectedMfRows);
    expect(result.totalRows).toBe(expectedStockRows + expectedMfRows);
    expect(upsert).toHaveBeenCalledTimes(expectedStockRows + expectedMfRows);

    // Every call keys the upsert by ISIN, matching the SystemFmvSeed schema.
    for (const call of upsert.mock.calls) {
      const arg = call[0] as { where: { isin: string }; create: { isin: string }; update: unknown };
      expect(arg.where.isin).toBe(arg.create.isin);
    }
  });

  it('is idempotent: calling it twice does not throw and issues the same number of upserts', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const fakePrisma = { systemFmvSeed: { upsert } } as unknown as PrismaClient;

    const first = await seedFmv(fakePrisma);
    upsert.mockClear();
    const second = await seedFmv(fakePrisma);

    expect(second.totalRows).toBe(first.totalRows);
    expect(upsert).toHaveBeenCalledTimes(first.totalRows);
  });
});
