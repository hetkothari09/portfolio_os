import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';

/**
 * Persistent Free-tier upsell on the Dashboard — always shown (not
 * dismissible) so the paid feature set stays visible ambiently, not just
 * when a user hits a locked feature and clicks through.
 */
export function UpgradeBanner() {
  const user = useAuthStore((s) => s.user);
  if (!user || user.plan !== 'FREE' || user.role === 'ADMIN') return null;

  return (
    <div className="rounded-lg border border-accent/25 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent px-4 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between gap-4 flex-wrap reveal">
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">You're on the Free plan</p>
          <p className="text-[12px] text-muted-foreground">
            Upgrade to Plus for the full tax report catalog, AA auto-import, multiple portfolios, and AI insights.
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/pricing">
          See plans <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
