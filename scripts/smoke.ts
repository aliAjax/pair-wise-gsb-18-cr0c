import {
  seedState,
  addRecord,
  appendEntry,
  advanceStage,
  completeRecord,
  reworkRecord,
  bookScope,
  releaseScope,
  rescheduleScope,
} from "../src/domain/store";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log("ok -", name); }
  else { failed++; console.log("FAIL -", name); }
}

let s = seedState();

// 1. 封药/充填后禁止补记
const locked = s.records.find((r) => r.tooth === "36")!;
let r = appendEntry(s, locked.id, { canal: "MB2", distanceToApexMm: 1, instrument: "K锉 #10", plan: "封药观察" });
check("封药后补记被拦截", !r.ok && !r.ok === true && (r as any).conflict.rule.includes("禁止补记"));

// 2. 超出根尖或距根尖超过3mm必须转显微会诊
const open46 = s.records.find((r) => r.tooth === "46")!;
r = appendEntry(s, open46.id, { canal: "远中", distanceToApexMm: 3.5, instrument: "K锉 #10", plan: "根管充填" });
check("距根尖3.5mm未转显微被拦截", !r.ok && (r as any).conflict.rule.includes("显微会诊"));
r = appendEntry(s, open46.id, { canal: "远中", distanceToApexMm: -0.5, instrument: "K锉 #10", plan: "根管充填" });
check("超出根尖未转显微被拦截", !r.ok && (r as any).conflict.rule.includes("显微会诊"));
r = appendEntry(s, open46.id, { canal: "远中", distanceToApexMm: 3.5, instrument: "K锉 #10", plan: "显微会诊" });
check("距根尖3.5mm转显微会诊可补记", r.ok);
if (r.ok) s = r.state;

// 3. 同一患者同一时段只能占一个显微台
r = bookScope(s, { patientId: "P003", patientName: "赵敏", tooth: "46", slot: "2026-09-23 09:00", station: "显微台B" });
check("同时段第二台被拦截", !r.ok && (r as any).conflict.rule.includes("只能占一个显微台") && (r as any).conflict.slot === "2026-09-23 09:00");
r = bookScope(s, { patientId: "P003", patientName: "赵敏", tooth: "46", slot: "2026-09-24 09:00", station: "显微台B" });
check("不同时段可预约", r.ok);
if (r.ok) s = r.state;

// 4. 改期先释放原时段
const appt = s.appointments.find((a) => a.tooth === "46" && a.status === "预约中" && a.slot === "2026-09-23 09:00")!;
r = rescheduleScope(s, appt.id, "2026-09-23 15:30");
check("改期成功", r.ok);
if (r.ok) {
  s = r.state;
  check("原时段已释放", s.appointments.some((a) => a.id === appt.id && a.status === "已释放"));
  check("新时段生效", s.appointments.some((a) => a.tooth === "46" && a.slot === "2026-09-23 15:30" && a.status === "预约中"));
}
// 改期到被本患者其他预约占用的时段应冲突
const appt2 = s.appointments.find((a) => a.tooth === "46" && a.status === "预约中")!;
r = rescheduleScope(s, appt2.id, "2026-09-24 09:00");
check("改期到已占时段被拦截", !r.ok && (r as any).conflict.rule.includes("只能占一个显微台"));

// 5. 处置完成冻结，冻结后禁止补记/改阶段
const open26 = s.records.find((r2) => r2.tooth === "26" && r2.status === "记录中")!;
r = completeRecord(s, open26.id);
check("完成处置", r.ok);
if (r.ok) {
  s = r.state;
  check("记录已冻结", s.records.find((x) => x.id === open26.id)!.status === "已冻结");
  const r2 = appendEntry(s, open26.id, { canal: "MB", distanceToApexMm: 1, instrument: "K锉 #15", plan: "封药观察" });
  check("冻结后补记被拦截", !r2.ok && (r2 as any).conflict.rule.includes("冻结"));
  const r3 = advanceStage(s, open26.id, "封药");
  check("冻结后改阶段被拦截", !r3.ok);
}

// 6. 返工生成带原因版本并保留旧值
r = reworkRecord(s, open26.id, "");
check("返工无原因被拦截", !r.ok && (r as any).conflict.rule.includes("返工"));
r = reworkRecord(s, open26.id, "根充超填，需再治疗");
check("返工生成新版本", r.ok);
if (r.ok) {
  s = r.state;
  const v3 = s.records.find((x) => x.supersedes === open26.id)!;
  check("版本号递增", v3.version === open26.version + 1);
  check("返工原因记录", v3.reworkReason === "根充超填，需再治疗");
  check("旧版本仍冻结保留", s.records.find((x) => x.id === open26.id)!.status === "已冻结");
  check("旧值保留", s.records.find((x) => x.id === open26.id)!.entries.length > 0);
}

// 7. 新增记录校验
r = addRecord(s, { patientId: "P002", patientName: "李强", tooth: "", canal: "MB", distanceToApexMm: 1, instrument: "K锉 #15", plan: "封药观察" });
check("缺牙位被拦截", !r.ok && (r as any).conflict.rule.includes("必填"));
r = addRecord(s, { patientId: "P002", patientName: "李强", tooth: "17", canal: "MB", distanceToApexMm: 4, instrument: "K锉 #15", plan: "封药观察" });
check("新记录超3mm未转显微被拦截", !r.ok);
r = addRecord(s, { patientId: "P002", patientName: "李强", tooth: "17", canal: "MB", distanceToApexMm: 1, instrument: "K锉 #15", plan: "封药观察" });
check("正常新增记录", r.ok);

// 8. 冲突对象携带牙位、根管、距离、时段、规则
const c = (bookScope(s, { patientId: "P001", patientName: "王芳", tooth: "26", slot: "2026-09-23 14:00", station: "显微台A" }) as any).conflict;
check("冲突含全部字段", !!c && ["rule", "tooth", "canal", "distance", "slot", "message"].every((k) => k in c));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
