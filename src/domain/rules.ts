// 校验与业务规则：全部为纯函数，不依赖 React、不依赖存储实现。
// 领域数据、校验和界面三者互相独立。

import type {
  AppState,
  InstrumentCase,
  MicroBooking,
  Snapshot,
  Stage,
} from "./types";
import { STAGE_ORDER } from "./types";

/** 距根尖超过 3mm（本规则中器械位于根管内更深处时）转显微会诊 */
export const MICRO_DISTANCE_LIMIT_MM = 3;

/** 规则编号，界面冲突清单据此展示命中的规则 */
export const RULE = {
  R1: "R1 超出根尖或距根尖超过三毫米，转显微会诊",
  R2: "R2 封药或充填后禁止补记",
  R3: "R3 同一患者同一时段只能占一个显微台",
  R4: "R4 改期须先释放原时段",
  R5: "R5 处置完成冻结，返工须生成带原因版本并保留旧值",
} as const;

export type RuleCode = keyof typeof RULE;

/** 校验结果：通过时 violations 为空 */
export interface Violation {
  code: RuleCode;
  field?: keyof Snapshot | "form";
  message: string;
}

/** 冲突清单条目：固定携带 牙位 / 根管 / 距离 / 时段 / 规则 */
export interface ConflictRow {
  code: RuleCode;
  rule: string;
  toothNo: string;
  canal: string;
  distanceText: string;
  slot: string;
  detail: string;
}

/** 是否需要显微会诊：超出根尖，或距根尖 > 3mm */
export function needsMicroscopy(s: Snapshot): boolean {
  return s.beyondApex || s.distanceToApex > MICRO_DISTANCE_LIMIT_MM;
}

/** 封药或充填后不允许再补记 */
export function isRecordLocked(stage: Stage): boolean {
  return stage !== "open";
}

export function distanceText(s: Pick<Snapshot, "distanceToApex" | "beyondApex">): string {
  return s.beyondApex ? "超出根尖" : `距根尖 ${s.distanceToApex}mm`;
}

/** 新建/编辑表单的字段校验 */
export function validateSnapshot(
  input: Partial<Snapshot>,
): Violation[] {
  const violations: Violation[] = [];
  if (!input.toothNo || !input.toothNo.trim()) {
    violations.push({ code: "R1", field: "toothNo", message: "牙位必填" });
  }
  if (!input.canal || !input.canal.trim()) {
    violations.push({ code: "R1", field: "canal", message: "根管必填" });
  }
  if (!input.instrument || !input.instrument.trim()) {
    violations.push({ code: "R1", field: "instrument", message: "分离器械必填" });
  }
  if (!input.plan || !input.plan.trim()) {
    violations.push({ code: "R1", field: "plan", message: "处置方案必填" });
  }
  // 超出根尖时距离无意义，按 0 归一化处理，不再校验数值
  const d = input.distanceToApex;
  if (!input.beyondApex) {
    if (d === undefined || d === null || Number.isNaN(d) || d < 0) {
      violations.push({
        code: "R1",
        field: "distanceToApex",
        message: "距根尖距离须为不小于 0 的数字（mm）",
      });
    } else if (d > 100) {
      violations.push({
        code: "R1",
        field: "distanceToApex",
        message: "距根尖距离超出合理范围",
      });
    }
  }
  return violations;
}

/** 阶段只能单向推进：处置中 -> 封药 -> 充填 */
export function canAdvance(current: Stage, next: Stage): Violation[] {
  if (STAGE_ORDER[next] <= STAGE_ORDER[current]) {
    return [{ code: "R2", message: "阶段只能按 处置中→封药→充填 单向推进" }];
  }
  return [];
}

/** 补记前置校验：冻结或封药/充填后一律拒绝 */
export function checkAddEntry(active: InstrumentCase, text: string): Violation[] {
  if (active.frozen) {
    return [{ code: "R5", message: "该牙位处置已完成并冻结，不能补记；如需修改请走返工" }];
  }
  if (isRecordLocked(active.current.stage)) {
    return [{ code: "R2", message: "封药或充填后禁止补记" }];
  }
  if (!text.trim()) {
    return [{ code: "R2", field: "form", message: "补记内容不能为空" }];
  }
  return [];
}

export function checkEdit(active: InstrumentCase): Violation[] {
  if (active.frozen) {
    return [{ code: "R5", message: "记录已冻结，不能编辑；返工后在新版本上修改" }];
  }
  if (isRecordLocked(active.current.stage)) {
    return [{ code: "R2", message: "封药或充填后禁止修改处置记录" }];
  }
  return [];
}

/** 同一患者同一时段只能占一个显微台（仅统计未释放预约） */
export function findBookingConflict(
  state: Pick<AppState, "bookings">,
  patientId: string,
  slot: string,
  excludeBookingId?: string,
): MicroBooking | undefined {
  return state.bookings.find(
    (b) =>
      b.status === "booked" &&
      b.id !== excludeBookingId &&
      b.patientId === patientId &&
      b.slot === slot,
  );
}

export function checkBook(
  state: Pick<AppState, "bookings">,
  active: InstrumentCase,
  slot: string,
  station: string,
): Violation[] {
  if (active.frozen) {
    return [{ code: "R5", message: "该牙位已完成冻结，不再接受预约" }];
  }
  if (!slot.trim() || !station.trim()) {
    return [{ code: "R3", field: "form", message: "时段与显微台均为必填" }];
  }
  if (!needsMicroscopy(active.current)) {
    return [{ code: "R1", message: "仅超出根尖或距根尖超过三毫米的病例可转显微会诊" }];
  }
  const hit = findBookingConflict(state, active.patientId, slot);
  if (hit) {
    return [
      {
        code: "R3",
        message: `同一时段已占用「${hit.station}」，同一患者不能同时占两个显微台`,
      },
    ];
  }
  return [];
}

/** 返工：仅冻结记录可返工，必须填写原因 */
export function checkRework(active: InstrumentCase, reason: string): Violation[] {
  if (!active.frozen) {
    return [{ code: "R5", message: "仅处置完成并冻结的记录可以返工" }];
  }
  if (!reason.trim()) {
    return [{ code: "R5", field: "form", message: "返工必须填写原因" }];
  }
  return [];
}

/** 改期前置：必须先释放原时段，释放需要说明原因 */
export function checkRelease(b: MicroBooking, reason: string): Violation[] {
  if (b.status === "released") {
    return [{ code: "R4", message: "该时段已经释放" }];
  }
  if (!reason.trim()) {
    return [{ code: "R4", field: "form", message: "改期须填写释放原因" }];
  }
  return [];
}

function row(
  code: RuleCode,
  active: InstrumentCase,
  slot: string,
  detail: string,
): ConflictRow {
  return {
    code,
    rule: RULE[code],
    toothNo: active.current.toothNo,
    canal: active.current.canal,
    distanceText: distanceText(active.current),
    slot,
    detail,
  };
}

/**
 * 汇总当前全部冲突/风险，供看板「冲突清单」展示。
 * 每条都列出：牙位、根管、距离、时段、命中规则。
 */
export function evaluateConflicts(state: AppState): ConflictRow[] {
  const rows: ConflictRow[] = [];
  const caseById = new Map(state.cases.map((c) => [c.id, c]));

  for (const active of state.cases) {
    // R1：达到显微会诊指征但没有任何生效预约
    if (needsMicroscopy(active.current)) {
      const booked = state.bookings.some(
        (b) => b.caseId === active.id && b.status === "booked",
      );
      if (!booked) {
        rows.push(
          row(
            "R1",
            active,
            "—",
            active.current.beyondApex
              ? "器械超出根尖孔，尚未预约显微会诊"
              : "距根尖超过 3mm，尚未预约显微会诊",
          ),
        );
      }
    }

    // R5：冻结后的旧版本作为历史保留展示
    active.generations
      .filter((g) => g.version < active.version && g.frozenValues)
      .forEach((g) => {
        rows.push(
          row(
            "R5",
            active,
            "—",
            `v${g.version} 已冻结保留（${g.reason}），当前 v${active.version}`,
          ),
        );
      });
  }

  // R3：同一患者同一时段重复占用
  const seen = new Map<string, MicroBooking[]>();
  for (const b of state.bookings) {
    if (b.status !== "booked") continue;
    const key = `${b.patientId}@${b.slot}`;
    const list = seen.get(key) ?? [];
    list.push(b);
    seen.set(key, list);
  }
  for (const list of seen.values()) {
    if (list.length > 1) {
      for (const b of list) {
        const active = caseById.get(b.caseId);
        if (active) {
          rows.push(
            row(
              "R3",
              active,
              b.slot,
              `同时占用 ${list.map((x) => x.station).join("、")}`,
            ),
          );
        }
      }
    }
  }

  // R4：改期先释放——已释放但原因缺失属于流程异常（理论上被校验拦截）
  for (const b of state.bookings) {
    if (b.status === "released" && !(b.releasedReason ?? "").trim()) {
      const active = caseById.get(b.caseId);
      if (active) {
        rows.push(row("R4", active, b.slot, "时段已释放但缺少释放原因"));
      }
    }
  }

  return rows;
}

/** 刷新一致性：牙位、处置、预约、版本四者结构自洽 */
export function checkConsistency(state: AppState): string[] {
  const errors: string[] = [];
  const caseIds = new Set(state.cases.map((c) => c.id));

  state.cases.forEach((c) => {
    const last = c.generations[c.generations.length - 1];
    if (!last || last.version !== c.version) {
      errors.push(`${c.current.toothNo}：版本号与版本链不一致`);
    }
    if (c.frozen !== Boolean(c.completedAt)) {
      errors.push(`${c.current.toothNo}：冻结状态与完成时间不一致`);
    }
    if (c.frozen && !last?.frozenValues) {
      errors.push(`${c.current.toothNo}：已冻结但缺少冻结快照`);
    }
    if (new Set(c.generations.map((g) => g.version)).size !== c.generations.length) {
      errors.push(`${c.current.toothNo}：版本号重复`);
    }
  });

  state.bookings.forEach((b) => {
    if (!caseIds.has(b.caseId)) {
      errors.push(`预约 ${b.slot}（${b.patientName}）指向不存在的牙位记录`);
    }
  });

  return errors;
}
