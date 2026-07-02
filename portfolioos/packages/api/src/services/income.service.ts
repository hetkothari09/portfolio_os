/**
 * Salary/income CRUD, plus the shared `activeMonthlyIncomeTotal` helper
 * used by Health Score (and any future module needing "monthly income").
 * Manual entries here are preferred over the Gmail-estimated NEFT/UPI
 * credit average — most users don't have Gmail connected.
 */

import { Decimal } from 'decimal.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { serializeMoney } from '@portfolioos/shared';

export interface SalaryIncomeInput {
  employerName: string;
  monthlyAmount: string | number;
  payDay?: number;
  isActive?: boolean;
  notes?: string | null;
}

const ZERO = new Decimal(0);

function d(v: { toString(): string } | null | undefined): Decimal {
  if (v == null) return ZERO;
  return new Decimal(v.toString());
}

function validateInput(input: SalaryIncomeInput) {
  if (!input.employerName?.trim()) throw new BadRequestError('Employer/source name required');
  if (new Decimal(input.monthlyAmount).lessThanOrEqualTo(0)) throw new BadRequestError('Monthly amount must be positive');
  if (input.payDay != null && (input.payDay < 1 || input.payDay > 31)) throw new BadRequestError('Pay day must be between 1 and 31');
}

function serialize(row: {
  id: string; userId: string; employerName: string; monthlyAmount: { toString(): string };
  payDay: number; isActive: boolean; notes: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: row.id,
    employerName: row.employerName,
    monthlyAmount: serializeMoney(d(row.monthlyAmount)),
    payDay: row.payDay,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSalaryIncomes(userId: string) {
  const rows = await prisma.salaryIncome.findMany({ where: { userId }, orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] });
  return rows.map(serialize);
}

export async function getSalaryIncome(userId: string, id: string) {
  const row = await prisma.salaryIncome.findFirst({ where: { id, userId } });
  if (!row) throw new NotFoundError('Income entry not found');
  return serialize(row);
}

export async function createSalaryIncome(userId: string, input: SalaryIncomeInput) {
  validateInput(input);
  const row = await prisma.salaryIncome.create({
    data: {
      userId,
      employerName: input.employerName.trim(),
      monthlyAmount: new Decimal(input.monthlyAmount).toString(),
      payDay: input.payDay ?? 1,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
    },
  });
  return serialize(row);
}

export async function updateSalaryIncome(userId: string, id: string, input: Partial<SalaryIncomeInput>) {
  const existing = await prisma.salaryIncome.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Income entry not found');
  if (input.employerName !== undefined || input.monthlyAmount !== undefined || input.payDay !== undefined) {
    validateInput({ ...existing, ...input } as SalaryIncomeInput);
  }
  const row = await prisma.salaryIncome.update({
    where: { id },
    data: {
      ...(input.employerName !== undefined ? { employerName: input.employerName.trim() } : {}),
      ...(input.monthlyAmount !== undefined ? { monthlyAmount: new Decimal(input.monthlyAmount).toString() } : {}),
      ...(input.payDay !== undefined ? { payDay: input.payDay } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
  return serialize(row);
}

export async function deleteSalaryIncome(userId: string, id: string) {
  const existing = await prisma.salaryIncome.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Income entry not found');
  await prisma.salaryIncome.delete({ where: { id } });
}

/** Sum of active entries' monthlyAmount. Zero if the user has none entered. */
export async function activeMonthlyIncomeTotal(userId: string): Promise<Decimal> {
  const rows = await prisma.salaryIncome.findMany({ where: { userId, isActive: true }, select: { monthlyAmount: true } });
  return rows.reduce((s, r) => s.plus(d(r.monthlyAmount)), ZERO);
}
