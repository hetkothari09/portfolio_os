import { useMemo } from 'react';
import { Crown, User, Eye, Settings2, Trash2, UserX } from 'lucide-react';
import { type FamilyMemberRow, type FamilyRole } from '@/api/families.api';

/**
 * Visual family tree — organic org-chart layout with connector lines.
 *
 * Uses the FamilyMember.invitedById chain as the edge:
 *   - Root(s) = members with invitedById NULL (family founders) OR
 *     orphans whose inviter isn't in the visible member set.
 *   - Children = members invited by the parent node, rendered below.
 *
 * Rendering: CSS grid + pseudo-element connector lines. Nodes are
 * pill-shaped cards with role glyph, name, email, and OWNER-only
 * action buttons. Handles arbitrary depth; siblings space themselves
 * evenly via flex.
 *
 * Layout inspiration: git commit graph / family-tree charts. Kept
 * to pure CSS to avoid pulling in react-flow / d3 for one component.
 */

interface TreeNode {
  member: FamilyMemberRow;
  children: TreeNode[];
}

function buildTree(members: FamilyMemberRow[]): TreeNode[] {
  const byUserId = new Map<string, TreeNode>();
  for (const m of members) byUserId.set(m.userId, { member: m, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byUserId.values()) {
    const parentId = node.member.invitedById;
    if (parentId && byUserId.has(parentId)) {
      byUserId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.member.role !== b.member.role) {
        const rank: Record<FamilyRole, number> = { OWNER: 0, CONTRIBUTOR: 1, VIEWER: 2 };
        return rank[a.member.role] - rank[b.member.role];
      }
      return a.member.joinedAt.localeCompare(b.member.joinedAt);
    });
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function roleTint(role: FamilyRole): { bg: string; ring: string; icon: typeof Crown } {
  if (role === 'OWNER') {
    return {
      bg: 'bg-gradient-to-br from-amber-400/30 to-amber-500/10 dark:from-amber-400/25 dark:to-amber-500/5',
      ring: 'ring-amber-500/50',
      icon: Crown,
    };
  }
  if (role === 'CONTRIBUTOR') {
    return {
      bg: 'bg-gradient-to-br from-sky-400/20 to-sky-500/5 dark:from-sky-400/15 dark:to-sky-500/5',
      ring: 'ring-sky-500/40',
      icon: User,
    };
  }
  return {
    bg: 'bg-gradient-to-br from-muted/70 to-muted/40',
    ring: 'ring-border',
    icon: Eye,
  };
}

interface Props {
  members: FamilyMemberRow[];
  currentUserId: string | undefined;
  isOwner: boolean;
  onEdit: (m: FamilyMemberRow) => void;
  onRevoke: (m: FamilyMemberRow) => void;
}

export function FamilyTreeCanvas({
  members,
  currentUserId,
  isOwner,
  onEdit,
  onRevoke,
}: Props) {
  const tree = useMemo(() => buildTree(members), [members]);
  if (tree.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        No members yet — invite someone below to grow the tree.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-4">
      <div className="flex justify-center gap-8 min-w-fit">
        {tree.map((node) => (
          <TreeSubtree
            key={node.member.id}
            node={node}
            depth={0}
            currentUserId={currentUserId}
            isOwner={isOwner}
            onEdit={onEdit}
            onRevoke={onRevoke}
          />
        ))}
      </div>
    </div>
  );
}

function TreeSubtree({
  node,
  depth,
  currentUserId,
  isOwner,
  onEdit,
  onRevoke,
}: {
  node: TreeNode;
  depth: number;
  currentUserId: string | undefined;
  isOwner: boolean;
  onEdit: (m: FamilyMemberRow) => void;
  onRevoke: (m: FamilyMemberRow) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isSelf = node.member.userId === currentUserId;

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        member={node.member}
        isSelf={isSelf}
        isOwner={isOwner}
        onEdit={onEdit}
        onRevoke={onRevoke}
      />
      {hasChildren && (
        <>
          {/* Trunk down from this node */}
          <div className="h-6 w-px bg-border" aria-hidden />
          {/* Horizontal bar spanning children */}
          {node.children.length > 1 && (
            <div className="relative h-px w-full bg-border" aria-hidden>
              <div className="absolute -top-px left-0 h-px" />
              <div className="absolute -top-px right-0 h-px" />
            </div>
          )}
          {/* Children row */}
          <div className="flex gap-6 pt-6 relative">
            {node.children.length > 1 && (
              <div
                className="absolute top-0 left-0 right-0 h-px bg-border pointer-events-none"
                aria-hidden
              />
            )}
            {node.children.map((child) => (
              <div key={child.member.id} className="relative flex flex-col items-center">
                {/* Riser up to the sibling bar */}
                <div
                  className="absolute -top-6 left-1/2 -translate-x-1/2 w-px h-6 bg-border"
                  aria-hidden
                />
                <TreeSubtree
                  node={child}
                  depth={depth + 1}
                  currentUserId={currentUserId}
                  isOwner={isOwner}
                  onEdit={onEdit}
                  onRevoke={onRevoke}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NodeCard({
  member,
  isSelf,
  isOwner,
  onEdit,
  onRevoke,
}: {
  member: FamilyMemberRow;
  isSelf: boolean;
  isOwner: boolean;
  onEdit: (m: FamilyMemberRow) => void;
  onRevoke: (m: FamilyMemberRow) => void;
}) {
  const revoked = member.status === 'REVOKED';
  const pending = member.status === 'PENDING';
  const t = roleTint(member.role);
  const RoleIcon = t.icon;
  const canManage = isOwner && !revoked && !isSelf;

  return (
    <div
      className={`
        relative w-64 rounded-xl border shadow-sm ${t.bg} ring-1 ${t.ring}
        ${revoked ? 'opacity-50' : ''}
      `}
    >
      {/* Role glyph badge — top right */}
      <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
        <RoleIcon
          className={`h-3 w-3 ${
            member.role === 'OWNER'
              ? 'text-amber-500'
              : member.role === 'CONTRIBUTOR'
              ? 'text-sky-500'
              : 'text-muted-foreground'
          }`}
          strokeWidth={2.2}
        />
      </div>

      <div className="flex items-center gap-3 p-3">
        {/* Avatar */}
        <div
          className={`h-11 w-11 rounded-full ring-2 ring-background flex items-center justify-center font-medium text-sm ${
            member.role === 'OWNER'
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
              : member.role === 'CONTRIBUTOR'
              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {initials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{member.name}</p>
            {isSelf && (
              <span className="text-[9px] uppercase tracking-kerned bg-foreground/10 rounded-sm px-1 py-0.5">
                you
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-kerned text-muted-foreground">
              {member.role.toLowerCase()}
            </span>
            {pending && (
              <span className="text-[9px] uppercase tracking-kerned text-amber-600 dark:text-amber-400">
                pending
              </span>
            )}
            {revoked && (
              <span className="text-[9px] uppercase tracking-kerned text-muted-foreground">
                revoked
              </span>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-1 border-t border-border/50 px-2 py-1.5">
          <button
            type="button"
            onClick={() => onEdit(member)}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1 rounded hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
            title="Edit permissions"
          >
            <Settings2 className="h-3 w-3" strokeWidth={1.9} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onRevoke(member)}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1 rounded hover:bg-background/60 text-muted-foreground hover:text-negative transition-colors"
            title="Revoke access"
          >
            <UserX className="h-3 w-3" strokeWidth={1.9} />
            Revoke
          </button>
        </div>
      )}
      {revoked && isOwner && (
        <div className="border-t border-border/50 px-3 py-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-kerned text-muted-foreground">
            revoked — audit only
          </span>
          <Trash2 className="h-3 w-3 text-muted-foreground/40" strokeWidth={1.9} />
        </div>
      )}
    </div>
  );
}
