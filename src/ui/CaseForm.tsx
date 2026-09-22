// 新增分离器械处置记录表单。校验由 domain/rules 完成，这里只收集输入。
import { useState } from "react";
import { actions, type ActionResult } from "../state/store";
import { ViolationList } from "./format";

const emptyForm = {
  patientName: "",
  patientId: "",
  toothNo: "",
  canal: "",
  distanceToApex: "",
  beyondApex: false,
  instrument: "",
  plan: "",
};

export function CaseForm() {
  const [form, setForm] = useState({ ...emptyForm });
  const [result, setResult] = useState<ActionResult | null>(null);

  const set = (key: keyof typeof emptyForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    const res = actions.addCase({
      patientName: form.patientName,
      patientId: form.patientId,
      toothNo: form.toothNo,
      canal: form.canal,
      distanceToApex: Number(form.distanceToApex),
      beyondApex: form.beyondApex,
      instrument: form.instrument,
      plan: form.plan,
    });
    setResult(res);
    if (res.ok) setForm({ ...emptyForm });
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>分离器械登记</p>
          <h2>新增牙位处置记录</h2>
        </div>
      </div>

      <div className="field-grid">
        <label>
          <span>患者姓名</span>
          <input
            value={form.patientName}
            onChange={(e) => set("patientName", e.target.value)}
            placeholder="如 陈晨"
          />
        </label>
        <label>
          <span>患者编号</span>
          <input
            value={form.patientId}
            onChange={(e) => set("patientId", e.target.value)}
            placeholder="如 P-1001（留空自动生成）"
          />
        </label>
        <label>
          <span>牙位 *</span>
          <input
            value={form.toothNo}
            onChange={(e) => set("toothNo", e.target.value)}
            placeholder="如 #36"
          />
        </label>
        <label>
          <span>根管 *</span>
          <input
            value={form.canal}
            onChange={(e) => set("canal", e.target.value)}
            placeholder="如 MB / 近颊 / 单根管"
          />
        </label>
        <label>
          <span>距根尖距离（mm）*</span>
          <input
            type="number"
            min={0}
            step={0.1}
            disabled={form.beyondApex}
            value={form.distanceToApex}
            onChange={(e) => set("distanceToApex", e.target.value)}
            placeholder="如 4.5"
          />
        </label>
        <label className="checkbox-label">
          <span>器械位置</span>
          <span className="checkbox-line">
            <input
              type="checkbox"
              checked={form.beyondApex}
              onChange={(e) => set("beyondApex", e.target.checked)}
            />
            超出根尖孔（勾选后距离栏禁用）
          </span>
        </label>
        <label>
          <span>分离器械 *</span>
          <input
            value={form.instrument}
            onChange={(e) => set("instrument", e.target.value)}
            placeholder="如 ProTaper F2（25mm 断段）"
          />
        </label>
        <label>
          <span>处置方案 *</span>
          <input
            value={form.plan}
            onChange={(e) => set("plan", e.target.value)}
            placeholder="如 建立旁路后超声取出"
          />
        </label>
      </div>

      <ViolationList items={result?.violations ?? []} />
      {result?.ok && <p className="ok-line">已登记，刷新页面后记录仍保留。</p>}

      <div className="form-actions">
        <button className="primary-action" onClick={submit}>
          登记分离器械
        </button>
        <button onClick={() => { setForm({ ...emptyForm }); setResult(null); }}>
          清空
        </button>
      </div>
    </section>
  );
}
