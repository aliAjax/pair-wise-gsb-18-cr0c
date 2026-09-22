// 状态层：基于 useSyncExternalStore 的极简 store（不引入任何依赖）。
// 所有写操作先调用 domain/rules 的纯函数校验，通过后才改状态；
// 状态变更同步写入 localStorage，刷新后牙位、处置、预约、版本保持一致。

import { useSyncExternalStore } from "react";
import type {
  AppState,
  Generation,
  InstrumentCase,
  MicroBooking,
  Snapshot,
  Stage,
} from "../domain/types";
import {
  canAdvance,
  checkAddEntry,
  checkBook,
  checkEdit,
  checkRelease,
  checkRework,
  validateSnapshot,
  type Violation,
} from "../domain/rules";
import { createSeedState } from "../domain/seed";

const STORAGE_KEY = "hxwl-04-separated-instrument-station:v1";

export interface ActionResult {
  ok: boolean;
  violations: Violation[];
}

const okResult: ActionResult = { ok: true, violations: [] };
const fail = (violations: Violation[]): ActionResult => ({ ok: false, violations });

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.cases) && Array.isArray(parsed.bookings)) {
        return parsed;
      }
    }
  } catch {
    // 存储损坏时回落到示例数据
  }
  return createSeedState();
}

let state: AppState = loadState();
const listeners = new Set<() => void>();

function emit(next: AppState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式等场景下仅保留内存状态
  }
  listeners.forEach((l) => l());
}

function commit(mutate: (draft: AppState) => void) {
  const draft: AppState = JSON.parse(JSON.stringify(state)) as AppState;
  mutate(draft);
  emit(draft);
}

function getCase(draft: AppState, id: string): InstrumentCase | undefined {
  return draft.cases.find((c) => c.id === id);
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function touch(c: InstrumentCase) {
  c.updatedAt = new Date().toISOString();
}

export interface NewCaseInput {
  patientId: string;
  patientName: string;
  toothNo: string;
  canal: string;
  distanceToApex: number;
  beyondApex: boolean;
  instrument: string;
  plan: string;
}

const store = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  resetSeed() {
    emit(createSeedState());
  },

  addCase(input: NewCaseInput): ActionResult {
    const { patientId, patientName, ...snapshotFields } = input;
    const violations = validateSnapshot(snapshotFields);
    if (violations.length) return fail(violations);

    const now = new Date().toISOString();
    const snapshot: Snapshot = {
      ...snapshotFields,
      // 超出根尖时距离栏不适用，归一化为 0
      distanceToApex: snapshotFields.beyondApex ? 0 : snapshotFields.distanceToApex,
      stage: "open",
    };
    const newCase: InstrumentCase = {
      id: uid("case"),
      patientId: patientId.trim() || uid("P"),
      patientName: patientName.trim() || "未命名患者",
      createdAt: now,
      updatedAt: now,
      version: 1,
      frozen: false,
      current: snapshot,
      generations: [
        { version: 1, reason: "首次记录", createdAt: now, baseline: { ...snapshot } },
      ],
      entries: [],
    };

    commit((draft) => {
      draft.cases.unshift(newCase);
    });
    return okResult;
  },

  updateCaseFields(id: string, patch: Partial<Snapshot>): ActionResult {
    const active = state.cases.find((c) => c.id === id);
    if (!active) return fail([{ code: "R5", message: "记录不存在" }]);
    const editViolations = checkEdit(active);
    if (editViolations.length) return fail(editViolations);

    const merged = { ...active.current, ...patch };
    const violations = validateSnapshot(merged);
    if (violations.length) return fail(violations);

    commit((draft) => {
      const c = getCase(draft, id)!;
      c.current = { ...c.current, ...patch };
      touch(c);
    });
    return okResult;
  },

  addEntry(id: string, text: string): ActionResult {
    const active = state.cases.find((c) => c.id === id);
    if (!active) return fail([{ code: "R2", message: "记录不存在" }]);
    const violations = checkAddEntry(active, text);
    if (violations.length) return fail(violations);

    commit((draft) => {
      const c = getCase(draft, id)!;
      c.entries.push({
        id: uid("e"),
        at: new Date().toISOString(),
        text: text.trim(),
      });
      touch(c);
    });
    return okResult;
  },

  advanceStage(id: string, next: Stage): ActionResult {
    const active = state.cases.find((c) => c.id === id);
    if (!active) return fail([{ code: "R2", message: "记录不存在" }]);
    const violations = [
      ...(active.frozen
        ? [{ code: "R5" as const, message: "记录已冻结，不能推进阶段" }]
        : []),
      ...canAdvance(active.current.stage, next),
    ];
    if (violations.length) return fail(violations);

    commit((draft) => {
      const c = getCase(draft, id)!;
      c.current.stage = next;
      touch(c);
    });
    return okResult;
  },

  /** 处置完成：冻结当前记录 */
  completeCase(id: string): ActionResult {
    const active = state.cases.find((c) => c.id === id);
    if (!active) return fail([{ code: "R5", message: "记录不存在" }]);
    if (active.frozen) return fail([{ code: "R5", message: "记录已冻结" }]);

    commit((draft) => {
      const c = getCase(draft, id)!;
      const now = new Date().toISOString();
      c.frozen = true;
      c.completedAt = now;
      const gen = c.generations[c.generations.length - 1];
      gen.frozenAt = now;
      gen.frozenValues = { ...c.current };
      touch(c);
    });
    return okResult;
  },

  /** 返工：冻结记录生成新版本（带原因），旧值原样保留 */
  rework(id: string, reason: string): ActionResult {
    const active = state.cases.find((c) => c.id === id);
    if (!active) return fail([{ code: "R5", message: "记录不存在" }]);
    const violations = checkRework(active, reason);
    if (violations.length) return fail(violations);

    commit((draft) => {
      const c = getCase(draft, id)!;
      const now = new Date().toISOString();
      const nextVersion = c.version + 1;
      const baseline: Snapshot = { ...c.current, stage: "open" };
      const generation: Generation = {
        version: nextVersion,
        reason: reason.trim(),
        createdAt: now,
        baseline: { ...baseline },
      };
      c.generations.push(generation);
      c.version = nextVersion;
      c.frozen = false;
      c.completedAt = undefined;
      c.current = baseline;
      c.entries.push({ id: uid("e"), at: now, text: `v${nextVersion} 返工启动：${reason.trim()}` });
      touch(c);
    });
    return okResult;
  },

  book(caseId: string, slot: string, station: string): ActionResult {
    const active = state.cases.find((c) => c.id === caseId);
    if (!active) return fail([{ code: "R3", message: "记录不存在" }]);
    const violations = checkBook(state, active, slot, station);
    if (violations.length) return fail(violations);

    commit((draft) => {
      const booking: MicroBooking = {
        id: uid("bk"),
        caseId,
        patientId: active.patientId,
        patientName: active.patientName,
        slot,
        station,
        status: "booked",
        createdAt: new Date().toISOString(),
      };
      draft.bookings.push(booking);
    });
    return okResult;
  },

  releaseBooking(bookingId: string, reason: string): ActionResult {
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return fail([{ code: "R4", message: "预约不存在" }]);
    const violations = checkRelease(booking, reason);
    if (violations.length) return fail(violations);

    commit((draft) => {
      const b = draft.bookings.find((x) => x.id === bookingId)!;
      b.status = "released";
      b.releasedAt = new Date().toISOString();
      b.releasedReason = reason.trim();
    });
    return okResult;
  },

  /** 改期：原子操作——先释放原时段，再占用新时段；任一步失败整体不变 */
  reschedule(bookingId: string, newSlot: string, newStation: string): ActionResult {
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return fail([{ code: "R4", message: "预约不存在" }]);
    if (booking.status === "released") {
      return fail([{ code: "R4", message: "原时段已释放，不能改期" }]);
    }
    const active = state.cases.find((c) => c.id === booking.caseId);
    if (!active) return fail([{ code: "R3", message: "关联记录不存在" }]);

    if (newSlot === booking.slot && newStation === booking.station) {
      return fail([{ code: "R4", message: "新时段与原时段相同，无需改期" }]);
    }

    // 在「已释放原时段」的假设状态上校验新预约，保证两步要么都成功要么都不做
    const hypothetical: AppState = JSON.parse(JSON.stringify(state));
    const old = hypothetical.bookings.find((b) => b.id === bookingId)!;
    old.status = "released";
    old.releasedAt = new Date().toISOString();
    old.releasedReason = "改期：先释放原时段";
    const violations = checkBook(hypothetical, active, newSlot, newStation);
    if (violations.length) return fail(violations);

    commit((draft) => {
      const old = draft.bookings.find((b) => b.id === bookingId)!;
      old.status = "released";
      old.releasedAt = new Date().toISOString();
      old.releasedReason = `改期至 ${newSlot} ${newStation}，先释放原时段`;
      draft.bookings.push({
        id: uid("bk"),
        caseId: active.id,
        patientId: active.patientId,
        patientName: active.patientName,
        slot: newSlot,
        station: newStation,
        status: "booked",
        createdAt: new Date().toISOString(),
      });
    });
    return okResult;
  },
};

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export const actions = store;
