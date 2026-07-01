import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Loader2,
  Users,
  UserPlus,
  Trash2,
  Copy,
  Settings2,
  X,
  ChevronDown,
  ChevronRight,
  Crown,
  User,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  familiesApi,
  NON_AC_CATEGORIES,
  type FamilyMemberRow,
  type FamilyRole,
  type MyFamily,
  type NonAcCategory,
} from '@/api/families.api';
import { apiErrorMessage } from '@/api/client';

/**
 * Family settings section — CRUD + invite + tree-based member list +
 * inline edit dialog. Roles/categories editable at any time by any
 * OWNER. Refetch config keeps member state fresh so a role change on
 * one session reflects within ~30s on the affected user's other tabs.
 *
 * Tree layout uses `FamilyMember.invitedById` as the edge — root nodes
 * are family founders (invitedById NULL, typically createdBy). Members
 * whose inviter no longer exists in the list get hoisted to root so
 * they're still visible.
 */
const REFETCH_MS = 30_000;

// AssetClass enum values that a member may be granted visibility on.
// Static list to avoid a Prisma-generated import into the web package.
const ASSET_CLASSES = [
  'EQUITY',
  'MUTUAL_FUND',
  'ETF',
  'FUTURES',
  'OPTIONS',
  'BOND',
  'GOVT_BOND',
  'CORPORATE_BOND',
  'FIXED_DEPOSIT',
  'RECURRING_DEPOSIT',
  'NPS',
  'PPF',
  'EPF',
  'GOLD_BOND',
  'GOLD_ETF',
  'PHYSICAL_GOLD',
  'PHYSICAL_SILVER',
  'ULIP',
  'INSURANCE',
  'REAL_ESTATE',
  'CRYPTOCURRENCY',
  'CASH',
  'NSC',
  'FOREIGN_EQUITY',
  'FOREX_PAIR',
  'OTHER',
] as const;

export function FamilySection() {
  const queryClient = useQueryClient();
  const familiesQuery = useQuery({
    queryKey: ['families', 'mine'],
    queryFn: () => familiesApi.list(),
    staleTime: REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchInterval: REFETCH_MS,
  });
  const families = familiesQuery.data ?? [];

  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const selected = families.find((f) => f.id === selectedFamilyId) ?? null;

  const [newFamilyName, setNewFamilyName] = useState('');
  const createFamilyMutation = useMutation({
    mutationFn: (name: string) => familiesApi.create({ name }),
    onSuccess: (res) => {
      toast.success('Family created');
      setNewFamilyName('');
      setSelectedFamilyId(res.id);
      queryClient.invalidateQueries({ queryKey: ['families', 'mine'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Create failed')),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Users className="h-4 w-4 text-accent" strokeWidth={1.9} />
        <CardTitle>Family</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create family */}
        <div className="space-y-2">
          <Label htmlFor="family-name">Create a new family</Label>
          <div className="flex gap-2">
            <Input
              id="family-name"
              placeholder="e.g. Kothari Family"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              className="flex-1"
              disabled={createFamilyMutation.isPending}
            />
            <Button
              onClick={() => createFamilyMutation.mutate(newFamilyName.trim())}
              disabled={!newFamilyName.trim() || createFamilyMutation.isPending}
            >
              {createFamilyMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Create
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You become the OWNER. Add other OWNERs later for joint families.
          </p>
        </div>

        {/* Existing families */}
        {familiesQuery.isLoading ? (
          <div className="text-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : families.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are not part of any family yet. Create one above, or accept an
            invitation from a family OWNER.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-kerned text-muted-foreground">
              Your families
            </p>
            {families.map((f) => (
              <FamilyRow
                key={f.id}
                family={f}
                selected={selectedFamilyId === f.id}
                onSelect={() =>
                  setSelectedFamilyId(selectedFamilyId === f.id ? null : f.id)
                }
              />
            ))}
          </div>
        )}

        {/* Detail: tree + members + invites */}
        {selected && <FamilyDetail family={selected} />}
      </CardContent>
    </Card>
  );
}

function FamilyRow({
  family,
  selected,
  onSelect,
}: {
  family: MyFamily;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left transition-colors ${
        selected
          ? 'border-accent bg-accent/5'
          : 'border-border hover:bg-muted/50'
      }`}
    >
      <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{family.name}</div>
        <div className="text-[11px] uppercase tracking-kerned text-muted-foreground">
          {family.role.toLowerCase()} · {family.status.toLowerCase()}
        </div>
      </div>
      {selected ? (
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Detail ─────────────────────────────────────────────────────────

function FamilyDetail({ family }: { family: MyFamily }) {
  const queryClient = useQueryClient();
  const isOwner = family.role === 'OWNER';

  const membersQuery = useQuery({
    queryKey: ['families', family.id, 'members'],
    queryFn: () => familiesApi.members(family.id),
    staleTime: REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchInterval: REFETCH_MS,
  });
  const pendingQuery = useQuery({
    queryKey: ['families', family.id, 'invitations'],
    queryFn: () => familiesApi.pendingInvitations(family.id),
    enabled: isOwner,
    staleTime: REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  const [editingMember, setEditingMember] = useState<FamilyMemberRow | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<FamilyRole>('CONTRIBUTOR');
  const [inviteCategories, setInviteCategories] = useState<NonAcCategory[]>([
    ...NON_AC_CATEGORIES,
  ]);
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: () =>
      familiesApi.invite(family.id, {
        invitedEmail: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        visibleCategories: inviteCategories,
      }),
    onSuccess: (res) => {
      toast.success('Invitation created');
      setInviteEmail('');
      setLastInviteToken(res.token);
      queryClient.invalidateQueries({ queryKey: ['families', family.id, 'invitations'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Invite failed')),
  });

  const revokeMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      familiesApi.revokeMember(family.id, memberUserId),
    onSuccess: () => {
      toast.success('Member revoked');
      queryClient.invalidateQueries({ queryKey: ['families', family.id, 'members'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Revoke failed')),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (invitationId: string) =>
      familiesApi.cancelInvitation(family.id, invitationId),
    onSuccess: () => {
      toast.success('Invitation cancelled');
      queryClient.invalidateQueries({ queryKey: ['families', family.id, 'invitations'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Cancel failed')),
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/families/invitations/${token}/accept`;
    void navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
  };

  const members = membersQuery.data ?? [];

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{family.name}</p>
        <span className="text-[10px] uppercase tracking-kerned text-muted-foreground">
          Your role: {family.role.toLowerCase()}
        </span>
      </div>

      {/* Family tree */}
      <div>
        <p className="text-[10px] uppercase tracking-kerned text-muted-foreground mb-2">
          Family tree
        </p>
        {membersQuery.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <FamilyTree
            members={members}
            isOwner={isOwner}
            onEdit={(m) => setEditingMember(m)}
            onRevoke={(m) => {
              if (confirm(`Revoke ${m.name}'s access?`)) revokeMutation.mutate(m.userId);
            }}
          />
        )}
      </div>

      {/* Invite */}
      {isOwner && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-kerned text-muted-foreground">
            Invite a member
          </p>
          <div className="flex gap-2 flex-wrap">
            <Input
              type="email"
              placeholder="member@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 min-w-[200px]"
              disabled={inviteMutation.isPending}
            />
            <select
              className="h-9 rounded-md border border-border bg-background text-sm px-2"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as FamilyRole)}
              disabled={inviteMutation.isPending}
            >
              <option value="OWNER">OWNER</option>
              <option value="CONTRIBUTOR">CONTRIBUTOR</option>
              <option value="VIEWER">VIEWER</option>
            </select>
            <Button
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" strokeWidth={1.7} />
              )}
              <span className="ml-1">Invite</span>
            </Button>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Category visibility · {inviteCategories.length}/{NON_AC_CATEGORIES.length}
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {NON_AC_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={inviteCategories.includes(c)}
                    onChange={(e) =>
                      setInviteCategories((prev) =>
                        e.target.checked
                          ? [...prev, c]
                          : prev.filter((x) => x !== c),
                      )
                    }
                  />
                  {c.replace(/_/g, ' ').toLowerCase()}
                </label>
              ))}
            </div>
          </details>
          {lastInviteToken && (
            <div className="flex items-center gap-2 rounded border border-border/70 bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground flex-1 truncate">
                Share this link with the invitee:
              </p>
              <button
                type="button"
                onClick={() => copyInviteLink(lastInviteToken)}
                className="text-[11px] flex items-center gap-1 text-accent hover:underline"
              >
                <Copy className="h-3 w-3" strokeWidth={1.9} /> Copy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending invitations */}
      {isOwner && (pendingQuery.data?.length ?? 0) > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-kerned text-muted-foreground mb-1.5">
            Pending invitations
          </p>
          <div className="space-y-1.5">
            {(pendingQuery.data ?? []).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border/70 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate">{inv.invitedEmail}</div>
                  <div className="text-[11px] uppercase tracking-kerned text-muted-foreground">
                    {inv.role.toLowerCase()} · expires{' '}
                    {new Date(inv.expiresAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Cancel invitation for ${inv.invitedEmail}?`)) {
                      cancelInviteMutation.mutate(inv.id);
                    }
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-negative"
                  title="Cancel invitation"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit member dialog */}
      {editingMember && (
        <EditMemberDialog
          familyId={family.id}
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}

// ─── Family tree render ─────────────────────────────────────────────

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
      // Family founders (no inviter) and orphans both surface at root.
      roots.push(node);
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.member.role !== b.member.role) {
        if (a.member.role === 'OWNER') return -1;
        if (b.member.role === 'OWNER') return 1;
      }
      return a.member.joinedAt.localeCompare(b.member.joinedAt);
    });
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

function FamilyTree({
  members,
  isOwner,
  onEdit,
  onRevoke,
}: {
  members: FamilyMemberRow[];
  isOwner: boolean;
  onEdit: (m: FamilyMemberRow) => void;
  onRevoke: (m: FamilyMemberRow) => void;
}) {
  const tree = useMemo(() => buildTree(members), [members]);
  if (tree.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No members yet — invite someone below to start the tree.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <TreeNodeRow
          key={node.member.id}
          node={node}
          depth={0}
          isOwner={isOwner}
          onEdit={onEdit}
          onRevoke={onRevoke}
        />
      ))}
    </div>
  );
}

function TreeNodeRow({
  node,
  depth,
  isOwner,
  onEdit,
  onRevoke,
}: {
  node: TreeNode;
  depth: number;
  isOwner: boolean;
  onEdit: (m: FamilyMemberRow) => void;
  onRevoke: (m: FamilyMemberRow) => void;
}) {
  const m = node.member;
  const isRevoked = m.status === 'REVOKED';
  const RoleIcon =
    m.role === 'OWNER' ? Crown : m.role === 'CONTRIBUTOR' ? User : Eye;

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 pr-2 rounded ${
          isRevoked ? 'opacity-50' : ''
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {depth > 0 && (
          <span
            className="text-muted-foreground/40 text-lg leading-none -ml-4 select-none"
            aria-hidden
          >
            └
          </span>
        )}
        <RoleIcon
          className={`h-4 w-4 ${
            m.role === 'OWNER'
              ? 'text-accent'
              : m.role === 'VIEWER'
              ? 'text-muted-foreground'
              : 'text-foreground/70'
          }`}
          strokeWidth={1.7}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {m.name}
            {isRevoked && (
              <span className="ml-2 text-[10px] uppercase tracking-kerned text-muted-foreground">
                revoked
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {m.email} · {m.role.toLowerCase()}
          </div>
        </div>
        {isOwner && !isRevoked && (
          <>
            <button
              type="button"
              onClick={() => onEdit(m)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Edit permissions"
            >
              <Settings2 className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
            <button
              type="button"
              onClick={() => onRevoke(m)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-negative"
              title="Revoke access"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          </>
        )}
      </div>
      {node.children.map((c) => (
        <TreeNodeRow
          key={c.member.id}
          node={c}
          depth={depth + 1}
          isOwner={isOwner}
          onEdit={onEdit}
          onRevoke={onRevoke}
        />
      ))}
    </>
  );
}

// ─── Edit dialog ─────────────────────────────────────────────────────

function EditMemberDialog({
  familyId,
  member,
  onClose,
}: {
  familyId: string;
  member: FamilyMemberRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<FamilyRole>(member.role);
  const [visibleAssetClasses, setVisibleAssetClasses] = useState<string[]>(
    member.visibleAssetClasses,
  );
  const [visibleCategories, setVisibleCategories] = useState<NonAcCategory[]>(
    member.visibleCategories,
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      familiesApi.updateMemberPermissions(familyId, member.userId, {
        role,
        visibleAssetClasses,
        visibleCategories,
      }),
    onSuccess: () => {
      toast.success('Permissions updated');
      queryClient.invalidateQueries({ queryKey: ['families', familyId, 'members'] });
      // Also invalidate the member's own family list so their Header
      // switcher/banner reflect the new role on their next tick.
      queryClient.invalidateQueries({ queryKey: ['families', 'mine'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Update failed')),
  });

  const toggleAll = <T extends string>(value: T[], all: readonly T[]) =>
    value.length === all.length ? [] : [...all];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <div className="text-sm font-semibold">Edit {member.name}</div>
            <div className="text-[11px] text-muted-foreground">{member.email}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              className="w-full h-9 rounded-md border border-border bg-background text-sm px-2"
              value={role}
              onChange={(e) => setRole(e.target.value as FamilyRole)}
            >
              <option value="OWNER">OWNER — full visibility, can manage family</option>
              <option value="CONTRIBUTOR">
                CONTRIBUTOR — filtered view, can write to family
              </option>
              <option value="VIEWER">VIEWER — filtered view, read-only</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              OWNERs bypass the visibility filters below.
            </p>
          </div>

          {/* Asset classes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Asset classes visible ({visibleAssetClasses.length}/
                {ASSET_CLASSES.length})
              </Label>
              <button
                type="button"
                onClick={() =>
                  setVisibleAssetClasses(toggleAll(visibleAssetClasses, ASSET_CLASSES))
                }
                className="text-[11px] text-accent hover:underline"
              >
                {visibleAssetClasses.length === ASSET_CLASSES.length ? 'None' : 'All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
              {ASSET_CLASSES.map((ac) => (
                <label key={ac} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={visibleAssetClasses.includes(ac)}
                    onChange={(e) =>
                      setVisibleAssetClasses((prev) =>
                        e.target.checked ? [...prev, ac] : prev.filter((x) => x !== ac),
                      )
                    }
                  />
                  {ac.replace(/_/g, ' ').toLowerCase()}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Only used when role is CONTRIBUTOR or VIEWER.
            </p>
          </div>

          {/* Categories */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Categories visible ({visibleCategories.length}/
                {NON_AC_CATEGORIES.length})
              </Label>
              <button
                type="button"
                onClick={() =>
                  setVisibleCategories(
                    toggleAll(visibleCategories, NON_AC_CATEGORIES) as NonAcCategory[],
                  )
                }
                className="text-[11px] text-accent hover:underline"
              >
                {visibleCategories.length === NON_AC_CATEGORIES.length ? 'None' : 'All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 border border-border rounded p-2">
              {NON_AC_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={visibleCategories.includes(c)}
                    onChange={(e) =>
                      setVisibleCategories((prev) =>
                        e.target.checked ? [...prev, c] : prev.filter((x) => x !== c),
                      )
                    }
                  />
                  {c.replace(/_/g, ' ').toLowerCase()}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
