import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * Shown instead of <AssistantButton> for users below the AI_ASSISTANT
 * tier — same floating position so the affordance stays familiar, but
 * links to /pricing instead of opening the chat panel. Never just hide
 * the feature outright (see LockedFeature's rationale) — a locked
 * button in the same spot still advertises what's behind the paywall.
 */
export function AssistantLockedButton() {
  return (
    <Link
      to="/pricing"
      className="fixed bottom-24 md:bottom-6 right-6 z-30 h-12 w-12 rounded-full bg-muted text-muted-foreground border border-border shadow-lg hover:text-foreground hover:shadow-xl transition-all flex items-center justify-center"
      aria-label="AI Assistant is locked — upgrade to unlock"
      title="Upgrade to Plus to unlock the AI Assistant"
    >
      <Lock className="h-5 w-5" strokeWidth={1.9} />
    </Link>
  );
}
