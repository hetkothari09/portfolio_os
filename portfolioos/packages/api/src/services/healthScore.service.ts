import { Decimal } from 'decimal.js';
import { prisma } from '../lib/prisma.js';
import { getDashboardNetWorth } from './dashboard.service.js';
import { listGoals } from './goals.service.js';
import {
  emergencyFundScore, investmentRateScore, debtBurdenScore,
  diversificationScore, insuranceScore, goalProgressScore, weightedOverall,
} from './healthScoreMath.js';

const ZERO = new Decimal(0);
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const LIQUID_CLASSES = new Set(['CASH', 'FIXED_DEPOSIT', 'RECURRING_DEPOSIT', 'POST_OFFICE_SAVINGS', 'POST_OFFICE_RD', 'POST_OFFICE_TD']);
const LIFE_POLICY_TYPES = new Set(['TERM', 'WHOLE_LIFE', 'ULIP', 'ENDOWMENT']);

function d(v: { toString(): string } | null | undefined): Decimal {
  if (v == null) return ZERO;
  return new Decimal(v.toString());
}

function monthsAgo(n: number): Date {
  const dt = new Date();
  dt.setUTCMonth(dt.getUTCMonth() - n);
  return dt;
}

async function estimateMonthlyIncome(userId: string): Promise<Decimal> {
  const events = await prisma.canonicalEvent.findMany({
    where: {
      userId,
      eventType: { in: ['NEFT_CREDIT', 'UPI_CREDIT'] },
      eventDate: { gte: monthsAgo(3) },
      status: { in: ['CONFIRMED', 'PROJECTED'] },
    },
    select: { amount: true },
  });
  const total = events.reduce((s, e) => s.plus(d(e.amount)), ZERO);
  return total.dividedBy(3);
}

async function estimateMonthlyExpenses(userId: string): Promise<Decimal> {
  const events = await prisma.canonicalEvent.findMany({
    where: {
      userId,
      eventType: { in: ['CARD_PURCHASE', 'UPI_DEBIT', 'NEFT_DEBIT'] },
      eventDate: { gte: monthsAgo(3) },
      status: { in: ['CONFIRMED', 'PROJECTED'] },
    },
    select: { amount: true },
  });
  const total = events.reduce((s, e) => s.plus(d(e.amount)), ZERO);
  return total.dividedBy(3);
}

async function estimateMonthlyInvestment(userId: string): Promise<Decimal> {
  const events = await prisma.canonicalEvent.findMany({
    where: {
      userId,
      eventType: { in: ['SIP_INSTALLMENT', 'BUY'] },
      eventDate: { gte: monthsAgo(3) },
      status: { in: ['CONFIRMED', 'PROJECTED'] },
    },
    select: { amount: true },
  });
  const total = events.reduce((s, e) => s.plus(d(e.amount)), ZERO);
  return total.dividedBy(3);
}

async function liquidAssetsTotal(userId: string): Promise<Decimal> {
  const rows = await prisma.holdingProjection.findMany({
    where: { portfolio: { userId }, assetClass: { in: Array.from(LIQUID_CLASSES) as never } },
    select: { currentValue: true, totalCost: true },
  });
  return rows.reduce((s, h) => s.plus(h.currentValue !== null ? d(h.currentValue) : d(h.totalCost)), ZERO);
}

async function largestSingleHoldingPct(userId: string): Promise<number> {
  const rows = await prisma.holdingProjection.findMany({
    where: { portfolio: { userId } },
    select: { currentValue: true, totalCost: true },
  });
  const values = rows.map((h) => (h.currentValue !== null ? d(h.currentValue) : d(h.totalCost)));
  const total = values.reduce((s, v) => s.plus(v), ZERO);
  if (total.lessThanOrEqualTo(0)) return 0;
  const max = values.reduce((m, v) => (v.greaterThan(m) ? v : m), ZERO);
  return max.dividedBy(total).times(100).toNumber();
}

async function monthlyCcMinimums(userId: string): Promise<Decimal> {
  const cards = await prisma.creditCard.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { statements: { orderBy: { forMonth: 'desc' }, take: 1 } },
  });
  return cards.reduce((s, c) => s.plus(d(c.statements[0]?.minimumDue)), ZERO);
}

async function lifeInsuranceTotals(userId: string): Promise<{ sumAssured: Decimal; hasPolicies: boolean }> {
  const policies = await prisma.insurancePolicy.findMany({
    where: { userId, status: 'ACTIVE', type: { in: Array.from(LIFE_POLICY_TYPES) } },
    select: { sumAssured: true },
  });
  return {
    sumAssured: policies.reduce((s, p) => s.plus(d(p.sumAssured)), ZERO),
    hasPolicies: policies.length > 0,
  };
}

async function userAge(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { dob: true } });
  if (!user?.dob) return null;
  const ageMs = Date.now() - user.dob.getTime();
  return Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
}

export interface HealthScoreResult {
  overallScore: number;
  grade: string;
  subScores: Record<
    'emergencyFund' | 'investmentRate' | 'debtBurden' | 'diversification' | 'insurance' | 'goalProgress',
    { score: number; insight: string; action: string }
  >;
  computedAt: string;
}

export async function computeHealthScore(userId: string, opts: { force?: boolean } = {}): Promise<HealthScoreResult> {
  if (!opts.force) {
    const cached = await prisma.healthScoreSnapshot.findUnique({ where: { userId } });
    if (cached && Date.now() - cached.computedAt.getTime() < STALE_AFTER_MS) {
      return {
        overallScore: cached.overallScore,
        grade: cached.grade,
        subScores: cached.subScores as HealthScoreResult['subScores'],
        computedAt: cached.computedAt.toISOString(),
      };
    }
  }

  const [netWorth, goals, monthlyIncome, monthlyExpenses, monthlyInvestment, liquidAssets, largestHoldingPct, ccMinimums, life, age] =
    await Promise.all([
      getDashboardNetWorth(userId),
      listGoals(userId),
      estimateMonthlyIncome(userId),
      estimateMonthlyExpenses(userId),
      estimateMonthlyInvestment(userId),
      liquidAssetsTotal(userId),
      largestSingleHoldingPct(userId),
      monthlyCcMinimums(userId),
      lifeInsuranceTotals(userId),
      userAge(userId),
    ]);

  const monthlyEmi = new Decimal(netWorth.liabilities.monthlyEmiTotal);
  const monthlyDebtPayments = monthlyEmi.plus(ccMinimums);
  const equityPct = netWorth.allocationBreakdown.find((a) => a.key === 'EQUITY')?.percent ?? 0;
  const annualIncome = monthlyIncome.times(12);
  const hasAnyHoldings = netWorth.allocationBreakdown.length > 0;

  const ef = emergencyFundScore(liquidAssets, monthlyExpenses);
  const ir = investmentRateScore(monthlyInvestment, monthlyIncome);
  const db = debtBurdenScore(monthlyDebtPayments, monthlyIncome);
  const dv = diversificationScore({
    classPercents: netWorth.allocationBreakdown.map((a) => ({ assetClass: a.key, percent: a.percent })),
    largestSingleHoldingPct: largestHoldingPct,
    equityPct,
    age,
  });
  const ins = insuranceScore(life.sumAssured, annualIncome, life.hasPolicies);
  const activeGoals = goals.filter((g) => g.status === 'ACTIVE');
  const gp = goalProgressScore(activeGoals.map((g) => g.progressPct));

  // A brand-new user with zero holdings of any kind has no signal for emergency-fund
  // coverage or diversification — the pure-math functions optimistically return 100 on
  // their zero-denominator guard clauses (correct for a real user who happens to have
  // zero recent expenses), which is misleading here. Treat it as "insufficient data" (50),
  // matching the existing convention used by insuranceScore/goalProgressScore below.
  // These overridden values feed BOTH the sub-score cards and weightedOverall so the
  // gauge and the cards never disagree.
  const emergencyFundScoreForOverall = hasAnyHoldings ? ef.score : 50;
  const diversificationScoreForOverall = hasAnyHoldings ? dv.score : 50;

  const { overall, grade } = weightedOverall({
    emergencyFund: emergencyFundScoreForOverall, investmentRate: ir.score, debtBurden: db.score,
    diversification: diversificationScoreForOverall, insurance: ins.score, goalProgress: gp.score,
  });

  const subScores: HealthScoreResult['subScores'] = {
    emergencyFund: hasAnyHoldings
      ? {
        score: Math.round(ef.score),
        insight: `You have ${ef.monthsCovered === Infinity ? '20+' : ef.monthsCovered.toFixed(1)} months of expenses covered. Target is 6 months.`,
        action: 'Build your emergency fund toward 6 months of expenses in liquid assets (savings, FDs).',
      }
      : {
        score: 50,
        insight: 'No portfolio data yet — add your bank accounts or investments to get an emergency-fund score.',
        action: 'Connect a bank account or add your investments to get scored.',
      },
    investmentRate: {
      score: Math.round(ir.score),
      insight: `You're investing ${ir.ratePct.toFixed(1)}% of income. Target is 20%.`,
      action: 'Increase your monthly SIP or equity investment toward 20% of income.',
    },
    debtBurden: {
      score: Math.round(db.score),
      insight: `Your EMIs and card payments consume ${db.burdenPct.toFixed(1)}% of income. Keep it under 40%.`,
      action: 'Consider prepaying high-interest debt or consolidating loans.',
    },
    diversification: hasAnyHoldings
      ? {
        score: Math.round(dv.score),
        insight: `Your equity allocation is ${equityPct.toFixed(1)}% of your portfolio.`,
        action: 'Rebalance so no single asset class or holding dominates your portfolio.',
      }
      : {
        score: 50,
        insight: 'No portfolio data yet to assess diversification.',
        action: 'Add your investments to get scored.',
      },
    insurance: {
      score: Math.round(ins.score),
      insight: life.hasPolicies
        ? `Your life cover is ₹${life.sumAssured.toFixed(0)}. Target is 10x annual income.`
        : 'No life insurance policies found — add one manually to get scored.',
      action: 'Review whether your life cover is at least 10x your annual income.',
    },
    goalProgress: {
      score: Math.round(gp.score),
      insight: activeGoals.length > 0
        ? `You are averaging ${Math.round(gp.score)}% progress across your active goals.`
        : 'You have not set any financial goals yet.',
      action: activeGoals.length > 0 ? 'Review goals that are falling behind.' : 'Set your first financial goal.',
    },
  };

  const computedAt = new Date();
  await prisma.healthScoreSnapshot.upsert({
    where: { userId },
    create: { userId, overallScore: overall, grade, subScores: subScores as never, computedAt },
    update: { overallScore: overall, grade, subScores: subScores as never, computedAt },
  });

  return { overallScore: overall, grade, subScores, computedAt: computedAt.toISOString() };
}
