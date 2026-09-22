export type Stage = "开髓" | "测长" | "封药" | "充填";
export type RecordStatus = "记录中" | "已锁定" | "已冻结";
export type AppointmentStatus = "预约中" | "已释放" | "已完成";

/** 单根根管的处置记录：根管、距根尖距离、器械、方案 */
export interface CanalEntry {
  id: string;
  canal: string;
  /** 距根尖距离 mm，负值表示器械超出根尖 */
  distanceToApexMm: number;
  instrument: string;
  plan: string;
  createdAt: string;
}

/** 牙位记录，返工时整体生成新版本，旧版本冻结保留 */
export interface ToothRecord {
  id: string;
  patientId: string;
  patientName: string;
  tooth: string;
  stage: Stage;
  status: RecordStatus;
  entries: CanalEntry[];
  version: number;
  reworkReason?: string;
  /** 本版本取代的记录 id */
  supersedes?: string;
  createdAt: string;
  updatedAt: string;
}

/** 显微台预约 */
export interface ScopeAppointment {
  id: string;
  patientId: string;
  patientName: string;
  tooth: string;
  slot: string;
  station: string;
  status: AppointmentStatus;
  createdAt: string;
}

/** 规则冲突，统一携带牙位、根管、距离、时段和规则 */
export interface Conflict {
  id: string;
  rule: string;
  tooth: string;
  canal: string;
  distance: string;
  slot: string;
  message: string;
  at: string;
}

export interface ClinicState {
  records: ToothRecord[];
  appointments: ScopeAppointment[];
}
