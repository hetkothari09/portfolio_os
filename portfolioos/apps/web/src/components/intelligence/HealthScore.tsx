import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { intelligenceApi, type HealthSubScore } from '@/api/intelligence.api';
import { HealthScoreGauge } from './HealthScoreGauge';
import { useState } from 'react';

const DIMENSION_LABELS: Record<string, string> = {
  emergencyFund: 'Emergency Fund',
  investmentRate: 'Investment Rate',
  debtBurden: 'Debt Burden',
  diversification: 'Diversification',
  insurance: 'Insurance Coverage',
  goalProgress: 'Goal Progress',
};

function dimensionColor(score: number): string {
  if (score < 40) return 'bg-negative';
  if (score < 70) return 'bg-orange-500';
  return 'bg-positive';
}

function DimensionCard({ id, sub }: { id: string; sub: HealthSubScore }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{DIMENSION_LABELS[id] ?? id}</span>
        <span className="numeric-display text-sm font-semibold">{sub.score}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div className={`h-full ${dimensionColor(sub.score)}`} style={{ width: `${sub.score}%` }} />
      </div>
      <p className="mt-2 text-[11.5px] text-muted-foreground">{sub.insight}</p>
      <button
        type="button"
        className="mt-1 text-[11.5px] font-medium text-accent-ink hover:underline"
        onClick={() => setExpanded((e) => !e)}
      >
        Fix this →
      </button>
      {expanded && <p className="mt-1 text-[11.5px] text-muted-foreground">{sub.action}</p>}
    </Card>
  );
}

export function HealthScore() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['intelligence', 'health-score'],
    queryFn: () => intelligenceApi.healthScore(),
  });

  if (isLoading) return <Card className="p-6 animate-pulse text-sm text-muted-foreground">Computing your financial health score…</Card>;
  if (error || !data) return <Card className="p-6 text-sm text-negative">Couldn't load your health score. Try again shortly.</Card>;

  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-center gap-2 p-6">
        <HealthScoreGauge score={data.overallScore} grade={data.grade} />
        <p className="text-xs text-muted-foreground">
          Updated {new Date(data.computedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data.subScores).map(([id, sub]) => (
          <DimensionCard key={id} id={id} sub={sub} />
        ))}
      </div>
    </div>
  );
}
