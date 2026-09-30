import { create } from 'zustand';

interface CollapsedGroupsState {
  collapsed: readonly number[];
  toggle: (groupId: number) => void;
}

/** Groups folded away in the editor. Kept for the session, so the next entry opens the same way. */
export const useCollapsedGroups = create<CollapsedGroupsState>((set) => ({
  collapsed: [],
  toggle: (groupId) =>
    set((s) => ({ collapsed: s.collapsed.includes(groupId) ? s.collapsed.filter((id) => id !== groupId) : [...s.collapsed, groupId] })),
}));
