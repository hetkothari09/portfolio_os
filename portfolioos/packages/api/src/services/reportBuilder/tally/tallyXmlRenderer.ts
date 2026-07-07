/**
 * Pure Tally XML rendering — no Prisma/DB access, so these functions are
 * directly fixture/snapshot-testable without a live database or env vars.
 * `tallyExport.service.ts` does the Prisma fetching and calls into here.
 */
import type { AccountType, VoucherType } from '@prisma/client';
import { resolveTallyParentGroup } from './accountGroupMapping.js';
import { buildLedgerMessage, buildVoucherMessage, wrapTallyEnvelope, type TallyVoucherLedgerEntry } from './tallyXmlBuilder.js';

// Confirmed exact Title Case against Tally/TallyPrime's own reserved
// voucher-type names (help.tallysolutions.com — "Voucher Types").
const VCH_TYPE_NAME: Record<VoucherType, string> = {
  JOURNAL: 'Journal',
  PAYMENT: 'Payment',
  RECEIPT: 'Receipt',
  CONTRA: 'Contra',
  PURCHASE: 'Purchase',
  SALES: 'Sales',
};

export interface TallyAccountInput {
  code: string;
  name: string;
  type: AccountType;
  openingBalance: string;
}

export interface TallyVoucherEntryInput {
  debitAccountName: string;
  creditAccountName: string;
  amount: string;
}

export interface TallyVoucherInput {
  voucherNo: string;
  type: VoucherType;
  date: Date;
  narration: string | null;
  entries: TallyVoucherEntryInput[];
}

/** ASSET/EXPENSE are debit-normal; LIABILITY/INCOME/EQUITY are credit-normal — same rule buildChartOfAccountsLayout uses for its D/C column. */
function isDebitNormal(type: AccountType): boolean {
  return type === 'ASSET' || type === 'EXPENSE';
}

export function renderTallyMastersXml(accounts: TallyAccountInput[]): string {
  const messages = accounts.map((a) =>
    buildLedgerMessage({
      name: a.name,
      parentGroup: resolveTallyParentGroup(a),
      openingBalance: a.openingBalance,
      isDebitOpening: isDebitNormal(a.type),
    }),
  );
  return wrapTallyEnvelope(messages);
}

/**
 * `referencedAccounts` are embedded as LEDGER master-creates ahead of the
 * VOUCHER messages so this file is self-contained against a brand-new/
 * empty Tally company — see the task's "always include the LEDGER
 * master-create messages for every account referenced by the vouchers"
 * rule. Import masters first anyway (UI copy says so) to carry opening
 * balances for accounts *not* referenced by any voucher in this range.
 */
export function renderTallyVouchersXml(vouchers: TallyVoucherInput[], referencedAccounts: TallyAccountInput[]): string {
  const ledgerMessages = referencedAccounts.map((a) =>
    buildLedgerMessage({
      name: a.name,
      parentGroup: resolveTallyParentGroup(a),
      openingBalance: a.openingBalance,
      isDebitOpening: isDebitNormal(a.type),
    }),
  );

  const voucherMessages = vouchers.map((v) => {
    const entries: TallyVoucherLedgerEntry[] = v.entries.flatMap((e) => [
      { ledgerName: e.debitAccountName, isDebit: true, amount: e.amount },
      { ledgerName: e.creditAccountName, isDebit: false, amount: e.amount },
    ]);
    return buildVoucherMessage({
      vchType: VCH_TYPE_NAME[v.type],
      voucherNumber: v.voucherNo,
      date: v.date,
      narration: v.narration,
      entries,
    });
  });

  return wrapTallyEnvelope([...ledgerMessages, ...voucherMessages]);
}
