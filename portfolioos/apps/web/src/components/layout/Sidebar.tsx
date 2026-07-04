import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SidebarNav } from './SidebarNav';
import { useMediaQuery, LG_QUERY } from '@/hooks/useMediaQuery';

export { ASSET_CLASS_ITEMS } from './navItems';

const SIDEBAR_KEY = 'sidebar_collapsed';

export function Sidebar() {
  const [userCollapsed, setUserCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_KEY) === 'true',
  );

  // At/above lg the sidebar honours the user's saved preference. In the
  // md–lg tablet band there isn't room for the full 256px rail, so it is
  // forced to the icon rail regardless of preference (and the manual
  // toggle is hidden — it wouldn't do anything).
  const isDesktop = useMediaQuery(LG_QUERY);
  const collapsed = isDesktop ? userCollapsed : true;

  function toggleCollapsed() {
    setUserCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  const toggle = isDesktop ? (
    <button
      type="button"
      onClick={toggleCollapsed}
      className="p-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors focus-ring"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  ) : undefined;

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 relative',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <SidebarNav collapsed={collapsed} renderToggle={toggle} />
    </aside>
  );
}
