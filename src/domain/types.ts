// 领域数据模型：牙体牙髓 - 根管内分离（折断）器械处置
// 本文件只定义数据结构，不包含校验逻辑与界面代码。

/** 处置阶段：处置中 -> 封药 -> 充填（单向推进） */
export type Stage = "open" | "medicated" | "filled";

export const STAGE_LABEL: Record<Stage, string> = {
  open: "处置中",
  medicated: "封药",
  filled: "充填",
};

export const STAGE_ORDER: Record<Stage, number> = {
  open: 0,
  medicated: 1,
  filled: 2,
};

/** 一条牙位处置记录在某一时刻的完整业务取值 */
export interface Snapshot {
  /** 牙位，如 #36 */
  toothNo: string;
  /** 根管，如 MB（近颊） */
  canal: string;
  /** 距根尖距离（mm），与 beyondApex 联合解释 */
  distanceToApex: number;
  /** 分离器械是否超出根尖孔 */
  beyondApex: boolean;
  /** 分离器械描述，如 ProTaper F2 25mm */
  instrument: string;
  /** 处置方案 */
  plan: string;
  stage: Stage;
}

/**
 * 版本（代次）。每次返工生成新版本并记录原因，
 * 旧版本的取值原样保留，不被覆盖。
 */
export interface Generation {
  version: number;
  /** v1 为「首次记录」，其余为返工原因 */
  reason: string;
  createdAt: string;
  /** 版本建立时的旧值 */
  baseline: Snapshot;
  /** 处置完成冻结时的取值 */
  frozenAt?: string;
  frozenValues?: Snapshot;
}

/** 处置过程中的逐条记录（流水） */
export interface CaseEntry {
  id: string;
  at: string;
  text: string;
}

/** 牙位级分离器械处置记录 */
export interface InstrumentCase {
  id: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  updatedAt: string;
  /** 当前工作版本号，对应 generations 中最后一代 */
  version: number;
  /** 处置完成后冻结 */
  frozen: boolean;
  completedAt?: string;
  generations: Generation[];
  current: Snapshot;
  entries: CaseEntry[];
}

export type BookingStatus = "booked" | "released";

/** 显微会诊台时段预约 */
export interface MicroBooking {
  id: string;
  caseId: string;
  patientId: string;
  patientName: string;
  /** 离散时段，如 2026-09-23 09:00–10:00 */
  slot: string;
  /** 显微台名称 */
  station: string;
  status: BookingStatus;
  createdAt: string;
  releasedAt?: string;
  releasedReason?: string;
}

export interface AppState {
  cases: InstrumentCase[];
  bookings: MicroBooking[];
}
