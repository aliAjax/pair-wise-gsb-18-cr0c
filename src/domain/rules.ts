import type { CanalEntry, Conflict, ScopeAppointment, ToothRecord } from "./types";

export const RULES = {
  MISSING_FIELD: "牙位、根管、器械和方案必填",
  INVALID_DISTANCE: "距根尖距离需为数字，负值表示超出根尖",
  LOCK_AFTER_SEAL_OR_FILL: "封药或充填后禁止补记",
  MICROSCOPE_REFERRAL: "超出根尖或距根尖超过3mm转显微会诊",
  ONE_SCOPE_PER_SLOT: "同一患者同一时段只能占一个显微台",
  RELEASE_BEFORE_RESCHEDULE: "改期先释放原时段",
  FREEZE_ON_COMPLETE: "处置完成冻结原记录",
  REWORK_NEEDS_REASON: "返工需填写原因并保留旧值",
} as const;

let seq = 0;

export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDistance(distanceToApexMm: number): string {
  if (distanceToApexMm < 0) return `超出根尖 ${Math.abs(distanceToApexMm)}mm`;
  if (distanceToApexMm === 0) return "平根尖";
  return `距根尖 ${distanceToApexMm}mm`;
}

/** 超出根尖（负值）或距根尖超过 3mm，需转显微会诊 */
export function needsMicroscope(distanceToApexMm: number): boolean {
  return distanceToApexMm < 0 || distanceToApexMm > 3;
}

export function makeConflict(input: Omit<Conflict, "id" | "at">): Conflict {
  return {
    ...input,
    id: nextId("cf"),
    at: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function recordConflict(
  rule: string,
  record: Pick<ToothRecord, "tooth">,
  entry: Pick<CanalEntry, "canal" | "distanceToApexMm">,
  message: string
): Conflict {
  return makeConflict({
    rule,
    tooth: record.tooth,
    canal: entry.canal,
    distance: formatDistance(entry.distanceToApexMm),
    slot: "—",
    message,
  });
}

/** 封药/充填或已冻结的记录禁止再改动 */
export function lockRule(record: ToothRecord): string | null {
  if (record.status === "已冻结") return RULES.FREEZE_ON_COMPLETE;
  if (record.status === "已锁定" || record.stage === "封药" || record.stage === "充填") {
    return RULES.LOCK_AFTER_SEAL_OR_FILL;
  }
  return null;
}

export function checkRequiredFields(input: {
  tooth: string;
  canal: string;
  instrument: string;
  plan: string;
}): Conflict | null {
  if (input.tooth.trim() && input.canal.trim() && input.instrument.trim() && input.plan.trim()) {
    return null;
  }
  return makeConflict({
    rule: RULES.MISSING_FIELD,
    tooth: input.tooth.trim() || "—",
    canal: input.canal.trim() || "—",
    distance: "—",
    slot: "—",
    message: "牙位、根管、器械和方案均需填写后才能保存",
  });
}

export function checkDistance(distanceToApexMm: number, tooth: string, canal: string): Conflict | null {
  if (Number.isFinite(distanceToApexMm)) return null;
  return makeConflict({
    rule: RULES.INVALID_DISTANCE,
    tooth: tooth || "—",
    canal: canal || "—",
    distance: "—",
    slot: "—",
    message: "距根尖距离需为数字，负值表示器械超出根尖",
  });
}

/** 补记前校验：锁定规则 + 显微会诊规则 */
export function checkAppendEntry(record: ToothRecord, entry: CanalEntry): Conflict | null {
  const locked = lockRule(record);
  if (locked) {
    return recordConflict(locked, record, entry, `${record.tooth} 牙已${record.stage === "开髓" || record.stage === "测长" ? record.status : record.stage}，禁止补记`);
  }
  if (needsMicroscope(entry.distanceToApexMm) && entry.plan !== "显微会诊") {
    return recordConflict(
      RULES.MICROSCOPE_REFERRAL,
      record,
      entry,
      `${entry.canal} ${formatDistance(entry.distanceToApexMm)}，方案须改为显微会诊`
    );
  }
  return null;
}

/** 同一患者同一时段只能占一个显微台 */
export function checkScopeBooking(
  appointments: ScopeAppointment[],
  candidate: Pick<ScopeAppointment, "patientId" | "tooth" | "slot">,
  ignoreId?: string
): Conflict | null {
  const clash = appointments.find(
    (a) =>
      a.id !== ignoreId &&
      a.status === "预约中" &&
      a.patientId === candidate.patientId &&
      a.slot === candidate.slot
  );
  if (!clash) return null;
  return makeConflict({
    rule: RULES.ONE_SCOPE_PER_SLOT,
    tooth: candidate.tooth || clash.tooth,
    canal: "—",
    distance: "—",
    slot: candidate.slot,
    message: `${clash.patientName} 在 ${candidate.slot} 已占用 ${clash.station}，请先改期或释放`,
  });
}
