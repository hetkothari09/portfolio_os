/**
 * Tally XML export orchestrator. Two separate outputs (masters, vouchers)
 * rather than one combined file — see the frontend catalog wiring in
 * TaxMisDownloads.tsx, which already exposes them as two report cards, and
 * the task-doc's fallback for "can masters+vouchers share one import call?"
 * being genuinely unverifiable without a real Tally install.
 *
 * XML rendering itself is pure and lives in tallyXmlRenderer.ts (no Prisma
 * import there, so it stays unit-testable without a DB/env). This module
 * is the thin Prisma-fetching layer around it. Callers
 * (reports.controller.ts) are responsible for calling
 * `ensureAccountingProjected(userId)` first, same as every other
 * accounting-flavoured download — this module assumes projection has
 * already run.
 */
import type { Account, Voucher, VoucherEntry } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { todayDDMMYYYY } from '../mprofitStyle.js';
import { renderTallyMastersXml, renderTallyVouchersXml, type TallyAccountInput, type TallyVoucherInput } from './tallyXmlRenderer.js';

export { renderTallyMastersXml, renderTallyVouchersXml } from './tallyXmlRenderer.js';
export type { TallyAccountInput, TallyVoucherEntryInput, TallyVoucherInput } from './tallyXmlRenderer.js';

export async function buildTallyMastersXml(userId: string): Promise<{ xml: string; filenameStem: string }> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { code: 'asc' },
  });

  const xml = renderTallyMastersXml(
    accounts.map((a: Account) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      openingBalance: a.openingBalance.toString(),
    })),
  );

  return { xml, filenameStem: `tally-masters-${todayDDMMYYYY()}` };
}

export async function buildTallyVouchersXml(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<{ xml: string; filenameStem: string }> {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (opts.from) dateFilter.gte = new Date(opts.from);
  if (opts.to) dateFilter.lte = new Date(opts.to);

  const vouchers = await prisma.voucher.findMany({
    where: { userId, ...(opts.from || opts.to ? { date: dateFilter } : {}) },
    orderBy: [{ date: 'asc' }, { voucherNo: 'asc' }],
    include: { entries: true },
  });

  const accountIds = new Set<string>();
  for (const v of vouchers) {
    for (const e of v.entries) {
      accountIds.add(e.debitAccountId);
      accountIds.add(e.creditAccountId);
    }
  }
  const accounts = await prisma.account.findMany({ where: { id: { in: [...accountIds] } } });
  const accountById = new Map(accounts.map((a: Account) => [a.id, a]));

  const voucherInputs: TallyVoucherInput[] = vouchers.map((v: Voucher & { entries: VoucherEntry[] }) => ({
    voucherNo: v.voucherNo,
    type: v.type,
    date: v.date,
    narration: v.narration,
    entries: v.entries.map((e: VoucherEntry) => ({
      debitAccountName: accountById.get(e.debitAccountId)?.name ?? 'Unknown Account',
      creditAccountName: accountById.get(e.creditAccountId)?.name ?? 'Unknown Account',
      amount: e.amount.toString(),
    })),
  }));

  const referencedAccounts: TallyAccountInput[] = accounts.map((a: Account) => ({
    code: a.code,
    name: a.name,
    type: a.type,
    openingBalance: a.openingBalance.toString(),
  }));

  const xml = renderTallyVouchersXml(voucherInputs, referencedAccounts);
  const stem = `tally-vouchers-${todayDDMMYYYY()}`;
  return { xml, filenameStem: stem };
}
