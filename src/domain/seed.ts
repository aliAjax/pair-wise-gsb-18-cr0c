// 领域常量与初始示例数据。不含逻辑，可被状态层与界面层共同引用。

import type { AppState, InstrumentCase, MicroBooking, Snapshot } from "./types";

export const MICRO_STATIONS = ["显微台 A", "显微台 B"];

/** 可选时段（离散档期） */
export const SLOTS = [
  "2026-09-23 09:00–10:00",
  "2026-09-23 10:00–11:00",
  "2026-09-23 14:00–15:00",
  "2026-09-24 09:00–10:00",
  "2026-09-24 10:00–11:00",
  "2026-09-24 14:00–15:00",
];

function makeCase(
  partial: Omit<InstrumentCase, "version">,
): InstrumentCase {
  return { ...partial, version: partial.generations[partial.generations.length - 1].version };
}

const c1Current: Snapshot = {
  toothNo: "#36",
  canal: "MB",
  distanceToApex: 4.5,
  beyondApex: false,
  instrument: "ProTaper F2（25mm 断段）",
  plan: "建立旁路后超声取出，无法旁路则显微会诊",
  stage: "open",
};

const c2Current: Snapshot = {
  toothNo: "#11",
  canal: "单根管",
  distanceToApex: 2.0,
  beyondApex: false,
  instrument: "K 锉 #25 尖段",
  plan: "封药观察，复诊评估取出时机",
  stage: "medicated",
};

const c3FrozenV1: Snapshot = {
  toothNo: "#46",
  canal: "ML",
  distanceToApex: 1.5,
  beyondApex: true,
  instrument: "ProTaper S1（断段穿出根尖孔）",
  plan: "首次显微取出失败，根尖外科预案",
  stage: "filled",
};

const c3Current: Snapshot = {
  ...c3FrozenV1,
  stage: "open",
  plan: "返工：显微镜下超声联合套管取出，备根尖手术",
};

export const seedCases: InstrumentCase[] = [
  makeCase({
    id: "case-36",
    patientId: "P-1001",
    patientName: "陈晨",
    createdAt: "2026-09-22T08:30:00.000Z",
    updatedAt: "2026-09-22T08:45:00.000Z",
    frozen: false,
    current: c1Current,
    generations: [
      {
        version: 1,
        reason: "首次记录",
        createdAt: "2026-09-22T08:30:00.000Z",
        baseline: { ...c1Current },
      },
    ],
    entries: [
      { id: "e-36-1", at: "2026-09-22T08:35:00.000Z", text: "X 线定位：MB 根管断段距根尖约 4.5mm" },
      { id: "e-36-2", at: "2026-09-22T08:42:00.000Z", text: "首次旁路建立失败，建议显微会诊" },
    ],
  }),
  makeCase({
    id: "case-11",
    patientId: "P-1002",
    patientName: "林可",
    createdAt: "2026-09-21T02:10:00.000Z",
    updatedAt: "2026-09-21T03:00:00.000Z",
    frozen: false,
    current: c2Current,
    generations: [
      {
        version: 1,
        reason: "首次记录",
        createdAt: "2026-09-21T02:10:00.000Z",
        baseline: { ...c2Current },
      },
    ],
    entries: [
      { id: "e-11-1", at: "2026-09-21T02:20:00.000Z", text: "髓腔封 Ca(OH)₂，暂封" },
    ],
  }),
  makeCase({
    id: "case-46",
    patientId: "P-1003",
    patientName: "周牧",
    createdAt: "2026-09-18T06:00:00.000Z",
    updatedAt: "2026-09-22T01:30:00.000Z",
    frozen: false,
    current: c3Current,
    generations: [
      {
        version: 1,
        reason: "首次记录",
        createdAt: "2026-09-18T06:00:00.000Z",
        baseline: { ...c3FrozenV1 },
        frozenAt: "2026-09-20T07:00:00.000Z",
        frozenValues: { ...c3FrozenV1 },
      },
      {
        version: 2,
        reason: "返工：断段超出根尖孔，首次取出未成功，需再次显微处置",
        createdAt: "2026-09-22T01:30:00.000Z",
        baseline: { ...c3Current },
      },
    ],
    entries: [
      { id: "e-46-1", at: "2026-09-18T06:15:00.000Z", text: "CBCT 确认断段穿出远中根尖孔约 1.5mm" },
      { id: "e-46-2", at: "2026-09-20T06:50:00.000Z", text: "显微取出未成功，完成当次处置并冻结 v1" },
      { id: "e-46-3", at: "2026-09-22T01:35:00.000Z", text: "v2 返工启动，预约第二次显微会诊" },
    ],
  }),
];

export const seedBookings: MicroBooking[] = [
  {
    id: "bk-46-a",
    caseId: "case-46",
    patientId: "P-1003",
    patientName: "周牧",
    slot: "2026-09-23 09:00–10:00",
    station: "显微台 A",
    status: "booked",
    createdAt: "2026-09-22T01:40:00.000Z",
  },
  {
    id: "bk-46-b",
    caseId: "case-46",
    patientId: "P-1003",
    patientName: "周牧",
    slot: "2026-09-23 09:00–10:00",
    station: "显微台 B",
    status: "booked",
    createdAt: "2026-09-22T01:42:00.000Z",
  },
  {
    id: "bk-11-old",
    caseId: "case-11",
    patientId: "P-1002",
    patientName: "林可",
    slot: "2026-09-22 14:00–15:00",
    station: "显微台 A",
    status: "released",
    createdAt: "2026-09-21T03:05:00.000Z",
    releasedAt: "2026-09-21T05:00:00.000Z",
    releasedReason: "改期：患者临时请假，先释放原时段",
  },
];

export function createSeedState(): AppState {
  return {
    cases: seedCases.map((c) => structuredCloneSafe(c)),
    bookings: seedBookings.map((b) => ({ ...b })),
  };
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
