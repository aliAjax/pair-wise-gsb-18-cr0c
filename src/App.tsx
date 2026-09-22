import { useMemo, useState } from "react";
import "./styles.css";
import { RULES, formatDistance, needsMicroscope } from "./domain/rules";
import {
  CANAL_OPTIONS,
  PATIENTS,
  PLAN_OPTIONS,
  SLOTS,
  STATIONS,
  addRecord,
  advanceStage,
  appendEntry,
  bookScope,
  completeRecord,
  loadState,
  releaseScope,
  rescheduleScope,
  reworkRecord,
  saveState,
  type ActionResult,
  type EntryInput,
} from "./domain/store";
import type { ClinicState, Conflict, ScopeAppointment, Stage, ToothRecord } from "./domain/types";

const FILTERS = ["全部", "记录中", "已锁定", "已冻结", "需显微会诊"];

function MetricCard({ label, value, index }: { label: string; value: number; index: number }) {
  const tones = ["status-ok", "status-watch", "status-danger", "status-ok", "status-watch"];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tones[index % tones.length]} />
    </article>
  );
}

function EntryForm({ onSubmit, submitLabel }: { onSubmit: (input: EntryInput) => void; submitLabel: string }) {
  const [canal, setCanal] = useState(CANAL_OPTIONS[0]);
  const [distance, setDistance] = useState("1.0");
  const [instrument, setInstrument] = useState("");
  const [plan, setPlan] = useState(PLAN_OPTIONS[0]);
  const parsed = Number.parseFloat(distance);
  const referral = Number.isFinite(parsed) && needsMicroscope(parsed);

  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ canal, distanceToApexMm: parsed, instrument: instrument.trim(), plan });
        setInstrument("");
      }}
    >
      <label>
        <span>根管</span>
        <select value={canal} onChange={(e) => setCanal(e.target.value)}>
          {CANAL_OPTIONS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        <span>距根尖距离 mm（负值=超出）</span>
        <input type="number" step="0.5" value={distance} onChange={(e) => setDistance(e.target.value)} required />
      </label>
      <label>
        <span>器械</span>
        <input placeholder="如 K锉 #30" value={instrument} onChange={(e) => setInstrument(e.target.value)} required />
      </label>
      <label>
        <span>方案</span>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}>
          {PLAN_OPTIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      {referral && plan !== "显微会诊" && <p className="hint warn">超出根尖或距根尖超过3mm，方案须改为显微会诊</p>}
      <button type="submit" className="primary-action">
        {submitLabel}
      </button>
    </form>
  );
}

function RecordCard({
  record,
  state,
  onAction,
}: {
  record: ToothRecord;
  state: ClinicState;
  onAction: (result: ActionResult) => void;
}) {
  const [appendOpen, setAppendOpen] = useState(false);
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reason, setReason] = useState("");
  const frozen = record.status === "已冻结";
  const supersedes = record.supersedes ? state.records.find((r) => r.id === record.supersedes) : undefined;

  return (
    <article className={`record-card ${frozen ? "frozen" : ""}`}>
      <div className="record-head">
        <div>
          <h3>
            #{record.tooth} · {record.patientName}
          </h3>
          <p className="record-sub">
            {record.patientId} · 更新于 {new Date(record.updatedAt).toLocaleString("zh-CN", { hour12: false })}
          </p>
        </div>
        <div className="badges">
          <span className="badge stage">{record.stage}</span>
          <span className={`badge ${record.status === "记录中" ? "open" : record.status === "已锁定" ? "locked" : "frozen"}`}>
            {record.status}
          </span>
          <span className="badge version">v{record.version}</span>
        </div>
      </div>

      {record.reworkReason && (
        <p className="rework-note">
          返工自 {supersedes ? `#${supersedes.tooth} v${supersedes.version}` : "旧版本"}：{record.reworkReason}
        </p>
      )}

      <table className="entry-table">
        <thead>
          <tr>
            <th>根管</th>
            <th>距根尖距离</th>
            <th>器械</th>
            <th>方案</th>
            <th>转诊</th>
          </tr>
        </thead>
        <tbody>
          {record.entries.map((e) => (
            <tr key={e.id}>
              <td>{e.canal}</td>
              <td className={needsMicroscope(e.distanceToApexMm) ? "danger-text" : ""}>{formatDistance(e.distanceToApexMm)}</td>
              <td>{e.instrument}</td>
              <td>{e.plan}</td>
              <td>{needsMicroscope(e.distanceToApexMm) ? "显微会诊" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="record-actions">
        <button onClick={() => setAppendOpen((v) => !v)}>{appendOpen ? "收起补记" : "补记根管"}</button>
        {(["封药", "充填"] as Stage[]).map((s) => (
          <button key={s} disabled={record.stage === s} onClick={() => onAction(advanceStage(state, record.id, s))}>
            {s}
          </button>
        ))}
        <button className="primary-action" disabled={frozen} onClick={() => onAction(completeRecord(state, record.id))}>
          完成处置
        </button>
        <button className="ghost-action" disabled={!frozen} onClick={() => setReworkOpen((v) => !v)}>
          返工
        </button>
      </div>

      {appendOpen && (
        <EntryForm
          submitLabel="保存补记"
          onSubmit={(input) => {
            onAction(appendEntry(state, record.id, input));
            setAppendOpen(false);
          }}
        />
      )}

      {reworkOpen && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(reworkRecord(state, record.id, reason));
            setReason("");
            setReworkOpen(false);
          }}
        >
          <label>
            <span>返工原因（旧版本值保留）</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：充填不密合" />
          </label>
          <button type="submit" className="primary-action">
            生成 v{record.version + 1} 返工版本
          </button>
        </form>
      )}
    </article>
  );
}

function AppointmentRow({
  appt,
  onAction,
  state,
}: {
  appt: ScopeAppointment;
  onAction: (result: ActionResult) => void;
  state: ClinicState;
}) {
  const [newSlot, setNewSlot] = useState(SLOTS[0]);
  const active = appt.status === "预约中";
  return (
    <article className={`appt-card ${active ? "" : "released"}`}>
      <div>
        <h3>
          {appt.patientName} · #{appt.tooth}
        </h3>
        <p>
          {appt.slot} · {appt.station} · {appt.status}
        </p>
      </div>
      {active && (
        <div className="appt-actions">
          <select value={newSlot} onChange={(e) => setNewSlot(e.target.value)}>
            {SLOTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button onClick={() => onAction(rescheduleScope(state, appt.id, newSlot))}>改期</button>
          <button className="ghost-action" onClick={() => onAction(releaseScope(state, appt.id))}>
            释放
          </button>
        </div>
      )}
    </article>
  );
}

function App() {
  const [clinic, setClinic] = useState<ClinicState>(loadState);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [filter, setFilter] = useState(FILTERS[0]);

  const [patientId, setPatientId] = useState(PATIENTS[0].id);
  const [tooth, setTooth] = useState("");
  const [apptTooth, setApptTooth] = useState("");
  const [apptPatientId, setApptPatientId] = useState(PATIENTS[0].id);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [station, setStation] = useState(STATIONS[0]);

  function apply(result: ActionResult) {
    if (result.ok) {
      setClinic(result.state);
      saveState(result.state);
    } else {
      setConflicts((prev) => [result.conflict, ...prev].slice(0, 30));
    }
  }

  const metrics = useMemo(
    () => [
      { label: "记录中牙位", value: clinic.records.filter((r) => r.status === "记录中").length },
      { label: "显微台预约", value: clinic.appointments.filter((a) => a.status === "预约中").length },
      { label: "已冻结版本", value: clinic.records.filter((r) => r.status === "已冻结").length },
      { label: "需显微会诊", value: clinic.records.filter((r) => r.entries.some((e) => needsMicroscope(e.distanceToApexMm))).length },
      { label: "待处理冲突", value: conflicts.length },
    ],
    [clinic, conflicts]
  );

  const filteredRecords = useMemo(() => {
    const sorted = [...clinic.records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (filter === "全部") return sorted;
    if (filter === "需显微会诊") return sorted.filter((r) => r.entries.some((e) => needsMicroscope(e.distanceToApexMm)));
    return sorted.filter((r) => r.status === filter);
  }, [clinic.records, filter]);

  const patientName = (id: string) => PATIENTS.find((p) => p.id === id)?.name ?? id;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · port 5104</p>
          <h1>分离器械处置台</h1>
          <p className="subtitle">
            按牙位记录根管、距根尖距离、器械和方案；封药或充填后禁止补记，超出根尖或距根尖超过三毫米转显微会诊，显微台同一患者同一时段只占一台。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>领域数据 / 校验规则 / 界面三层独立，localStorage 持久化，刷新后牙位、处置、预约和版本一致</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} label={m.label} value={m.value} index={i} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>筛选</h2>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f} className={filter === f ? "chip-active" : ""} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <h2>处置规则</h2>
          <ul className="rule-list">
            {Object.values(RULES).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>牙体牙髓</p>
              <h2>新增牙位记录</h2>
            </div>
          </div>
          <div className="new-record">
            <label>
              <span>患者</span>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                {PATIENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.id}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>牙位（FDI）</span>
              <input placeholder="如 36" value={tooth} onChange={(e) => setTooth(e.target.value)} />
            </label>
          </div>
          <EntryForm
            submitLabel="保存牙位记录"
            onSubmit={(input) => {
              apply(addRecord(clinic, { patientId, patientName: patientName(patientId), tooth, ...input }));
              setTooth("");
            }}
          />
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>牙位 · 处置 · 版本</p>
            <h2>处置记录（{filteredRecords.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {filteredRecords.map((r) => (
            <RecordCard key={r.id} record={r} state={clinic} onAction={apply} />
          ))}
          {filteredRecords.length === 0 && <p className="hint">当前筛选下没有记录</p>}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>显微会诊</p>
            <h2>显微台预约</h2>
          </div>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            apply(bookScope(clinic, { patientId: apptPatientId, patientName: patientName(apptPatientId), tooth: apptTooth, slot, station }));
            setApptTooth("");
          }}
        >
          <label>
            <span>患者</span>
            <select value={apptPatientId} onChange={(e) => setApptPatientId(e.target.value)}>
              {PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.id}）
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>牙位</span>
            <input placeholder="如 46" value={apptTooth} onChange={(e) => setApptTooth(e.target.value)} required />
          </label>
          <label>
            <span>时段</span>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <span>台位</span>
            <select value={station} onChange={(e) => setStation(e.target.value)}>
              {STATIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary-action">
            预约显微台
          </button>
        </form>
        <div className="appt-list">
          {clinic.appointments.map((a) => (
            <AppointmentRow key={a.id} appt={a} onAction={apply} state={clinic} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>规则引擎</p>
            <h2>冲突列表（{conflicts.length}）</h2>
          </div>
          <button className="ghost-action" onClick={() => setConflicts([])}>
            清空
          </button>
        </div>
        <div className="conflict-list">
          {conflicts.map((c) => (
            <article key={c.id} className="conflict-card">
              <div className="conflict-head">
                <span className="badge danger">{c.rule}</span>
                <span className="hint">{c.at}</span>
              </div>
              <p>{c.message}</p>
              <div className="conflict-grid">
                <span>牙位：{c.tooth}</span>
                <span>根管：{c.canal}</span>
                <span>距离：{c.distance}</span>
                <span>时段：{c.slot}</span>
              </div>
            </article>
          ))}
          {conflicts.length === 0 && <p className="hint">暂无冲突，被规则拦截的操作会列在这里</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
