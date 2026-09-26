import { create } from 'zustand';
import { db } from '../utils/db';
import { newId } from '../utils/id';
import { isRoundSealed, sealedRoundText } from '../utils/roundLock';
import { usePlotStore } from './plotStore';
import type { TreeRecord, TreeRecordDraft } from '../types/tree';

/** 样地锁定往期后，小于当前期的样木记录拒绝新增、改动或移除 */
function assertTreeRoundWritable(plotId: string, round: number): void {
  const plot = usePlotStore.getState().items.find((p) => p.id === plotId);
  if (isRoundSealed(plot, round)) {
    throw new Error(sealedRoundText(round));
  }
}

interface TreeState {
  items: TreeRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (draft: TreeRecordDraft) => Promise<TreeRecord>;
  addMany: (drafts: TreeRecordDraft[]) => Promise<TreeRecord[]>;
  update: (id: string, patch: Partial<TreeRecord>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byPlot: (plotId: string, round?: number) => TreeRecord[];
}

export const useTreeStore = create<TreeState>((set, get) => ({
  items: [],
  loaded: false,
  async load() {
    const rows = await db.trees.toArray();
    rows.sort((a, b) => a.round - b.round || a.treeNo.localeCompare(b.treeNo));
    set({ items: rows, loaded: true });
  },
  async add(draft) {
    assertTreeRoundWritable(draft.plotId, draft.round);
    const record: TreeRecord = { ...draft, id: newId('tree'), measuredAt: Date.now() };
    await db.trees.put(record);
    set({ items: [...get().items, record] });
    return record;
  },
  async addMany(drafts) {
    drafts.forEach((d) => assertTreeRoundWritable(d.plotId, d.round));
    const records: TreeRecord[] = drafts.map((d) => ({
      ...d,
      id: newId('tree'),
      measuredAt: Date.now(),
    }));
    await db.trees.bulkPut(records);
    set({ items: [...get().items, ...records] });
    return records;
  },
  async update(id, patch) {
    const existing = get().items.find((it) => it.id === id) ?? (await db.trees.get(id));
    if (existing) {
      assertTreeRoundWritable(existing.plotId, existing.round);
      if (patch.round !== undefined) assertTreeRoundWritable(existing.plotId, patch.round);
    }
    await db.trees.update(id, patch);
    set({ items: get().items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  },
  async remove(id) {
    const existing = get().items.find((it) => it.id === id) ?? (await db.trees.get(id));
    if (existing) assertTreeRoundWritable(existing.plotId, existing.round);
    await db.trees.delete(id);
    set({ items: get().items.filter((it) => it.id !== id) });
  },
  byPlot(plotId, round) {
    return get()
      .items.filter((it) => it.plotId === plotId && (round === undefined || it.round === round))
      .sort((a, b) => a.treeNo.localeCompare(b.treeNo, 'zh-Hans-CN', { numeric: true }));
  },
}));
