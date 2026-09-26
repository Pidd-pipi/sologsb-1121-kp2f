import { create } from 'zustand';
import { db } from '../utils/db';
import { newId } from '../utils/id';
import { isRoundSealed, sealedRoundText } from '../utils/roundLock';
import { usePlotStore } from './plotStore';
import type { RegenShrub, RegenShrubDraft } from '../types/regen';

/** 样地锁定往期后，小于当前期的样方记录拒绝新增、改动或移除 */
function assertRegenRoundWritable(plotId: string, round: number): void {
  const plot = usePlotStore.getState().items.find((p) => p.id === plotId);
  if (isRoundSealed(plot, round)) {
    throw new Error(sealedRoundText(round));
  }
}

interface RegenState {
  items: RegenShrub[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (draft: RegenShrubDraft) => Promise<RegenShrub>;
  update: (id: string, patch: Partial<RegenShrub>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byPlot: (plotId: string, round?: number) => RegenShrub[];
}

export const useRegenStore = create<RegenState>((set, get) => ({
  items: [],
  loaded: false,
  async load() {
    const rows = await db.regens.toArray();
    rows.sort((a, b) => a.round - b.round || a.layer.localeCompare(b.layer));
    set({ items: rows, loaded: true });
  },
  async add(draft) {
    assertRegenRoundWritable(draft.plotId, draft.round);
    const record: RegenShrub = { ...draft, id: newId('regen') };
    await db.regens.put(record);
    set({ items: [...get().items, record] });
    return record;
  },
  async update(id, patch) {
    const existing = get().items.find((it) => it.id === id) ?? (await db.regens.get(id));
    if (existing) {
      assertRegenRoundWritable(existing.plotId, existing.round);
      if (patch.round !== undefined) assertRegenRoundWritable(existing.plotId, patch.round);
    }
    await db.regens.update(id, patch);
    set({ items: get().items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  },
  async remove(id) {
    const existing = get().items.find((it) => it.id === id) ?? (await db.regens.get(id));
    if (existing) assertRegenRoundWritable(existing.plotId, existing.round);
    await db.regens.delete(id);
    set({ items: get().items.filter((it) => it.id !== id) });
  },
  byPlot(plotId, round) {
    return get().items.filter((it) => it.plotId === plotId && (round === undefined || it.round === round));
  },
}));
