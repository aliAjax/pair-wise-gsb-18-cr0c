import {
  RULES,
  checkAppendEntry,
  checkDistance,
  checkRequiredFields,
  checkScopeBooking,
  lockRule,
  makeConflict,
  needsMicroscope,
  nextId,
  nowIso,
} from "./rules";
import type { CanalEntry, ClinicState, Conflict, ScopeAppointment, Stage, ToothRecord } from "./types";

export const STORAGE_KEY = "hxwl-04-clinic-state-v1";

export const PATIENTS = [
  { id: "P001", name: "王芳" },
  { id: "P002", name: "李强" },
  { id: "P003", name: "赵敏" },
];

export const CANAL_OPTIONS = ["MB", "MB2", "DB", "P", "近中颊", "近中舌", "远中", "单根管"];
export const PLAN_OPTIONS = ["封药观察", "根管充填", "显微会诊", "再治疗", "拔除"];
export const STATIONS = ["显微台A", "显微台B"];
export const SLOTS = [
  "2026-09-23 09:00",
  "2026-09-23 10:30",
  "2026-09-23 14:00",
  "2026-09-23 15:30",
  "2026-09-24 09:00",
  "2026-09-24 10:30",
  "2026-09-24 14:00",
  "2026-09-24 15:30",
];

function entry(canal: string, distanceToApexMm: number, instrument: string, plan: string, createdAt: string): CanalEntry {
  return { id: nextId("ce"), canal, distanceToApexMm, instrument, plan, createdAt };
}

export function seedState(): ClinicState {
  const t1 = "2026-09-20T09:20:00.000Z";
  const t2 = "2026-09-21T02:40:00.000Z";
  const t3 = "2026-09-21T07:10:00.000Z";
  const t4 = "2026-09-22T01:30:00.000Z";
  const records: ToothRecord[] = [
    {
      id: "tr-36-v1",
      patientId: "P001",
      patientName: "王芳",
      tooth: "36",
      stage: "封药",
      status: "已锁定",
      entries: [
        entry("MB", 1.0, "K锉 #30", "封药观察", t1),
        entry("DB", 1.0, "K锉 #30", "封药观察", t1),
        entry("P", 1.5, "K锉 #25", "封药观察", t1),
      ],
      version: 1,
      createdAt: t1,
      updatedAt: t2,
    },
    {
      id: "tr-11-v1",
      patientId: "P002",
      patientName: "李强",
      tooth: "11",
      stage: "充填",
      status: "已锁定",
      entries: [entry("单根管", 0.5, "机用镍钛 #25", "根管充填", t2)],
      version: 1,
      createdAt: t2,
      updatedAt: t3,
    },
    {
      id: "tr-46-v1",
      patientId: "P003",
      patientName: "赵敏",
      tooth: "46",
      stage: "测长",
      status: "记录中",
      entries: [
        entry("近中颊", 2.0, "K锉 #15", "根管充填", t3),
        entry("近中舌", 3.5, "K锉 #10", "显微会诊", t3),
      ],
      version: 1,
      createdAt: t3,
      updatedAt: t3,
    },
    {
      id: "tr-26-v1",
      patientId: "P001",
      patientName: "王芳",
      tooth: "26",
      stage: "充填",
      status: "已冻结",
      entries: [entry("单根管", 1.0, "机用镍钛 #30", "根管充填", t1)],
      version: 1,
      createdAt: t1,
      updatedAt: t2,
    },
    {
      id: "tr-26-v2",
      patientId: "P001",
      patientName: "王芳",
      tooth: "26",
      stage: "开髓",
      status: "记录中",
      entries: [entry("单根管", 1.0, "机用镍钛 #30", "再治疗", t4)],
      version: 2,
      reworkReason: "充填不密合，拍片见根尖区空隙",
      supersedes: "tr-26-v1",
      createdAt: t4,
      updatedAt: t4,
    },
  ];
  const appointments: ScopeAppointment[] = [
    {
      id: "sa-1",
      patientId: "P003",
      patientName: "赵敏",
      tooth: "46",
      slot: "2026-09-23 09:00",
      station: "显微台A",
      status: "预约中",
      createdAt: t3,
    },
    {
      id: "sa-2",
      patientId: "P001",
      patientName: "王芳",
      tooth: "26",
      slot: "2026-09-23 14:00",
      station: "显微台B",
      status: "预约中",
      createdAt: t4,
    },
  ];
  return { records, appointments };
}

export function loadState(): ClinicState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ClinicState;
      if (Array.isArray(parsed.records) && Array.isArray(parsed.appointments)) return parsed;
    }
  } catch {
    // 存储不可用时回退到示例数据
  }
  return seedState();
}

export function saveState(state: ClinicState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时仅保留内存状态
  }
}

export type ActionResult = { ok: true; state: ClinicState } | { ok: false; conflict: Conflict };

function fail(conflict: Conflict): ActionResult {
  return { ok: false, conflict };
}

export interface EntryInput {
  canal: string;
  distanceToApexMm: number;
  instrument: string;
  plan: string;
}

function buildEntry(input: EntryInput): CanalEntry {
  return { ...input, id: nextId("ce"), createdAt: nowIso() };
}

function validateEntry(tooth: string, input: EntryInput): Conflict | null {
  return (
    checkRequiredFields({ tooth, canal: input.canal, instrument: input.instrument, plan: input.plan }) ??
    checkDistance(input.distanceToApexMm, tooth, input.canal)
  );
}

/** 新增牙位记录（含首条根管处置） */
export function addRecord(
  state: ClinicState,
  input: { patientId: string; patientName: string; tooth: string } & EntryInput
): ActionResult {
  const tooth = input.tooth.trim();
  const invalid = validateEntry(tooth, input);
  if (invalid) return fail(invalid);
  const entry = buildEntry({ ...input, canal: input.canal.trim(), instrument: input.instrument.trim() });
  if (needsMicroscope(entry.distanceToApexMm) && entry.plan !== "显微会诊") {
    return fail(
      makeConflict({
        rule: RULES.MICROSCOPE_REFERRAL,
        tooth,
        canal: entry.canal,
        distance: entry.distanceToApexMm < 0 ? `超出根尖 ${Math.abs(entry.distanceToApexMm)}mm` : `距根尖 ${entry.distanceToApexMm}mm`,
        slot: "—",
        message: `${entry.canal} 超出根尖或距根尖超过3mm，方案须改为显微会诊`,
      })
    );
  }
  const now = nowIso();
  const record: ToothRecord = {
    id: nextId("tr"),
    patientId: input.patientId,
    patientName: input.patientName,
    tooth,
    stage: "开髓",
    status: "记录中",
    entries: [entry],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, state: { ...state, records: [record, ...state.records] } };
}

/** 补记根管：封药/充填/冻结后禁止 */
export function appendEntry(state: ClinicState, recordId: string, input: EntryInput): ActionResult {
  const record = state.records.find((r) => r.id === recordId);
  if (!record) return fail(makeConflict({ rule: "记录不存在", tooth: "—", canal: input.canal, distance: "—", slot: "—", message: "目标牙位记录不存在" }));
  const invalid = validateEntry(record.tooth, input);
  if (invalid) return fail(invalid);
  const entry = buildEntry({ ...input, canal: input.canal.trim(), instrument: input.instrument.trim() });
  const conflict = checkAppendEntry(record, entry);
  if (conflict) return fail(conflict);
  const records = state.records.map((r) =>
    r.id === recordId ? { ...r, entries: [...r.entries, entry], updatedAt: nowIso() } : r
  );
  return { ok: true, state: { ...state, records } };
}

/** 推进阶段；进入封药/充填即锁定 */
export function advanceStage(state: ClinicState, recordId: string, stage: Stage): ActionResult {
  const record = state.records.find((r) => r.id === recordId);
  if (!record) return fail(makeConflict({ rule: "记录不存在", tooth: "—", canal: "—", distance: "—", slot: "—", message: "目标牙位记录不存在" }));
  const locked = lockRule(record);
  if (locked) {
    return fail(
      makeConflict({
        rule: locked,
        tooth: record.tooth,
        canal: "—",
        distance: "—",
        slot: "—",
        message: `${record.tooth} 牙已${record.status === "已冻结" ? "冻结" : record.stage}，不能回退阶段`,
      })
    );
  }
  const records = state.records.map((r) =>
    r.id === recordId
      ? { ...r, stage, status: stage === "封药" || stage === "充填" ? "已锁定" : r.status, updatedAt: nowIso() }
      : r
  );
  return { ok: true, state: { ...state, records } };
}

/** 处置完成：冻结原记录 */
export function completeRecord(state: ClinicState, recordId: string): ActionResult {
  const record = state.records.find((r) => r.id === recordId);
  if (!record) return fail(makeConflict({ rule: "记录不存在", tooth: "—", canal: "—", distance: "—", slot: "—", message: "目标牙位记录不存在" }));
  if (record.status === "已冻结") {
    return fail(
      makeConflict({
        rule: RULES.FREEZE_ON_COMPLETE,
        tooth: record.tooth,
        canal: "—",
        distance: "—",
        slot: "—",
        message: `${record.tooth} 牙 v${record.version} 已冻结，如需修改请走返工`,
      })
    );
  }
  const records = state.records.map((r) =>
    r.id === recordId ? { ...r, status: "已冻结" as const, updatedAt: nowIso() } : r
  );
  return { ok: true, state: { ...state, records } };
}

/** 返工：冻结记录生成带原因的新版本，旧值保留 */
export function reworkRecord(state: ClinicState, recordId: string, reason: string): ActionResult {
  const record = state.records.find((r) => r.id === recordId);
  if (!record) return fail(makeConflict({ rule: "记录不存在", tooth: "—", canal: "—", distance: "—", slot: "—", message: "目标牙位记录不存在" }));
  if (record.status !== "已冻结") {
    return fail(
      makeConflict({
        rule: RULES.FREEZE_ON_COMPLETE,
        tooth: record.tooth,
        canal: "—",
        distance: "—",
        slot: "—",
        message: "仅已冻结的记录可以返工",
      })
    );
  }
  if (!reason.trim()) {
    return fail(
      makeConflict({
        rule: RULES.REWORK_NEEDS_REASON,
        tooth: record.tooth,
        canal: "—",
        distance: "—",
        slot: "—",
        message: "返工必须填写原因，旧版本值将保留",
      })
    );
  }
  const now = nowIso();
  const next: ToothRecord = {
    ...record,
    id: nextId("tr"),
    stage: "开髓",
    status: "记录中",
    entries: record.entries.map((e) => ({ ...e, id: nextId("ce"), createdAt: now })),
    version: record.version + 1,
    reworkReason: reason.trim(),
    supersedes: record.id,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, state: { ...state, records: [next, ...state.records] } };
}

/** 预约显微台：同一患者同一时段只能占一个台 */
export function bookScope(
  state: ClinicState,
  input: { patientId: string; patientName: string; tooth: string; slot: string; station: string }
): ActionResult {
  const conflict = checkScopeBooking(state.appointments, input);
  if (conflict) return fail(conflict);
  const appointment: ScopeAppointment = {
    ...input,
    tooth: input.tooth.trim() || "—",
    id: nextId("sa"),
    status: "预约中",
    createdAt: nowIso(),
  };
  return { ok: true, state: { ...state, appointments: [appointment, ...state.appointments] } };
}

/** 释放显微台时段 */
export function releaseScope(state: ClinicState, appointmentId: string): ActionResult {
  const appointments = state.appointments.map((a) =>
    a.id === appointmentId && a.status === "预约中" ? { ...a, status: "已释放" as const } : a
  );
  return { ok: true, state: { ...state, appointments } };
}

/** 改期：先释放原时段，再占用新时段 */
export function rescheduleScope(state: ClinicState, appointmentId: string, newSlot: string): ActionResult {
  const target = state.appointments.find((a) => a.id === appointmentId);
  if (!target || target.status !== "预约中") {
    return fail(
      makeConflict({
        rule: RULES.RELEASE_BEFORE_RESCHEDULE,
        tooth: target?.tooth ?? "—",
        canal: "—",
        distance: "—",
        slot: newSlot,
        message: "仅预约中的显微台可以改期",
      })
    );
  }
  const conflict = checkScopeBooking(state.appointments, { ...target, slot: newSlot }, target.id);
  if (conflict) return fail(conflict);
  const released: ScopeAppointment = { ...target, status: "已释放" };
  const moved: ScopeAppointment = {
    ...target,
    id: nextId("sa"),
    slot: newSlot,
    status: "预约中",
    createdAt: nowIso(),
  };
  const appointments = [moved, ...state.appointments.map((a) => (a.id === target.id ? released : a))];
  return { ok: true, state: { ...state, appointments } };
}
