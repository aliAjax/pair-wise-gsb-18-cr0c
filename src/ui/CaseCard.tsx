// 牙位记录卡：展示牙位/根管/距根尖距离/器械/方案，
// 提供阶段推进、补记、完成冻结、返工（带原因新版本）及显微预约入口。
import { useState } from "react";
import type { InstrumentCase, Snapshot, Stage } from "../domain/types";
import { STAGE_LABEL } from "../domain/types";
import {
  distanceText,
  isRecordLocked,
  needsMicroscopy,
  type Violation,
} from "../domain/rules";
import { actions } from "../state/store";
import { ViolationList, fmtTime } from "./format";
import { CaseBookings } from "./CaseBookings";

interface Props {
  active: InstrumentCase;
}

export function CaseCard({ active }: Props) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Snapshot>(active.current);
  const [entryText, setEntryText] = useState("");
  const [reworkReason, setReworkReason] = useState("");
  const [showRework, setShowRework] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [notice, setNotice] = useState("");

  const locked = isRecordLocked(active.current.stage);
  const micro = needsMicroscopy(active.current);

  function apply(res: { ok: boolean; violations: Violation[] }, okText: string) {
    setViolations(res.violations);
    setNotice(res.ok ? okText : "");
    return res.ok;
  }

  function startEdit() {
    const violations: Violation[] = active.frozen
      ? [{ code: "R5", message: "记录已冻结，不能编辑；返工后在新版本上修改" }]
      : locked
        ? [{ code: "R2", message: "封药或充填后禁止修改处置记录" }]
        : [];
    if (violations.length) {
      setViolations(violations);
      return;
    }
    setEditForm({ ...active.current });
    setEditing(true);
    setViolations([]);
  }

  function saveEdit() {
    const res = actions.updateCaseFields(active.id, {
      toothNo: editForm.toothNo,
      canal: editForm.canal,
      distanceToApex: Number(editForm.distanceToApex),
      beyondApex: editForm.beyondApex,
      instrument: editForm.instrument,
      plan: editForm.plan,
    });
    if (apply(res, "修改已保存到当前版本。")) setEditing(false);
  }

  function addEntry() {
    const res = actions.addEntry(active.id, entryText);
    if (apply(res, "补记已追加（仅处置中允许）。")) setEntryText("");
  }

  function advance(next: Stage) {
    apply(actions.advanceStage(active.id, next), `阶段已推进至「${STAGE_LABEL[next]}」，此后禁止补记。`);
  }

  function complete() {
    apply(actions.completeCase(active.id), "处置完成，原记录已冻结。修改需走返工。");
  }

  function rework() {
    const res = actions.rework(active.id, reworkReason);
    if (apply(res, `已生成 v${active.version + 1}，旧版本取值已保留。`)) {
      setShowRework(false);
      setReworkReason("");
    }
  }

  const s = active.current;

  return (
    <article className={`record-card case-card ${active.frozen ? "frozen" : ""}`}>
      <header className="case-header">
        <div className="case-title">
          <h3>
            {s.toothNo}
            <span className="canal-sep">·</span>
            {s.canal}
          </h3>
          <p className="patient-line">
            {active.patientName}（{active.patientId}）
          </p>
        </div>
        <div className="case-badges">
          <span className={`tag tag-stage stage-${s.stage}`}>{STAGE_LABEL[s.stage]}</span>
          <span className="tag tag-version">v{active.version}</span>
          {micro && <span className="tag tag-danger">显微指征</span>}
          {active.frozen && <span className="tag tag-frozen">已冻结</span>}
        </div>
      </header>

      {editing ? (
        <div className="field-grid edit-grid">
          <label>
            <span>牙位</span>
            <input value={editForm.toothNo} onChange={(e) => setEditForm({ ...editForm, toothNo: e.target.value })} />
          </label>
          <label>
            <span>根管</span>
            <input value={editForm.canal} onChange={(e) => setEditForm({ ...editForm, canal: e.target.value })} />
          </label>
          <label>
            <span>距根尖距离（mm）</span>
            <input
              type="number" min={0} step={0.1}
              disabled={editForm.beyondApex}
              value={editForm.distanceToApex}
              onChange={(e) => setEditForm({ ...editForm, distanceToApex: Number(e.target.value) })}
            />
          </label>
          <label className="checkbox-label">
            <span>器械位置</span>
            <span className="checkbox-line">
              <input
                type="checkbox"
                checked={editForm.beyondApex}
                onChange={(e) => setEditForm({ ...editForm, beyondApex: e.target.checked })}
              />
              超出根尖孔
            </span>
          </label>
          <label className="span-2">
            <span>分离器械</span>
            <input value={editForm.instrument} onChange={(e) => setEditForm({ ...editForm, instrument: e.target.value })} />
          </label>
          <label className="span-2">
            <span>处置方案</span>
            <input value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })} />
          </label>
        </div>
      ) : (
        <dl className="snapshot-grid">
          <div><dt>牙位</dt><dd>{s.toothNo}</dd></div>
          <div><dt>根管</dt><dd>{s.canal}</dd></div>
          <div>
            <dt>距根尖距离</dt>
            <dd className={micro ? "danger-text" : ""}>{distanceText(s)}</dd>
          </div>
          <div><dt>分离器械</dt><dd>{s.instrument}</dd></div>
          <div className="span-2"><dt>处置方案</dt><dd>{s.plan}</dd></div>
        </dl>
      )}

      <ViolationList items={violations} />
      {notice && <p className="ok-line">{notice}</p>}

      <div className="case-actions">
        {editing ? (
          <>
            <button className="primary-action small" onClick={saveEdit}>保存修改</button>
            <button onClick={() => setEditing(false)}>取消</button>
          </>
        ) : (
          <>
            <button onClick={startEdit} disabled={active.frozen || locked}>
              编辑处置记录
            </button>
            {s.stage === "open" && !active.frozen && (
              <button onClick={() => advance("medicated")}>推进至封药</button>
            )}
            {s.stage === "medicated" && !active.frozen && (
              <button onClick={() => advance("filled")}>推进至充填</button>
            )}
            {!active.frozen && (
              <button className="primary-action small" onClick={complete}>
                处置完成并冻结
              </button>
            )}
            {active.frozen && !showRework && (
              <button onClick={() => { setShowRework(true); setViolations([]); }}>
                返工（生成新版本）
              </button>
            )}
          </>
        )}
      </div>

      {showRework && active.frozen && (
        <div className="rework-box">
          <label>
            <span>返工原因 *（旧版本取值将原样保留）</span>
            <input
              value={reworkReason}
              onChange={(e) => setReworkReason(e.target.value)}
              placeholder="如：首次取出失败，需二次显微处置"
            />
          </label>
          <div className="case-actions">
            <button className="primary-action small" onClick={rework}>确认返工，生成 v{active.version + 1}</button>
            <button onClick={() => setShowRework(false)}>取消</button>
          </div>
        </div>
      )}

      <section className="entries-box">
        <p className="sub-title">处置记录（流水）</p>
        {active.frozen || locked ? (
          <p className="dim">
            {active.frozen
              ? "记录已冻结，禁止补记；返工生成新版本后可继续记录。"
              : "封药或充填后禁止补记。"}
          </p>
        ) : (
          <div className="entry-add">
            <input
              value={entryText}
              onChange={(e) => setEntryText(e.target.value)}
              placeholder="补记处置过程（仅「处置中」可补记）"
            />
            <button className="small" onClick={addEntry}>补记</button>
          </div>
        )}
        <ul className="entry-list">
          {[...active.entries].reverse().map((en) => (
            <li key={en.id}>
              <time>{fmtTime(en.at)}</time>
              <span>{en.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <CaseBookings active={active} />

      <section className="generations-box">
        <p className="sub-title">版本链（旧值保留）</p>
        <ol className="generation-list">
          {active.generations.map((g) => (
            <li key={g.version} className={g.version === active.version ? "current-gen" : ""}>
              <header>
                <strong>v{g.version}</strong>
                <span>{g.version === 1 ? "首次记录" : `返工：${g.reason}`}</span>
                <time>{fmtTime(g.createdAt)}</time>
                {g.frozenValues && <span className="tag tag-frozen">冻结于 {fmtTime(g.frozenAt!)}</span>}
              </header>
              <p className="gen-values">
                {g.frozenValues
                  ? `${g.frozenValues.toothNo} / ${g.frozenValues.canal} / ${distanceText(g.frozenValues)} / ${STAGE_LABEL[g.frozenValues.stage]}`
                  : `${g.baseline.toothNo} / ${g.baseline.canal} / ${distanceText(g.baseline)} / ${STAGE_LABEL[g.baseline.stage]}`}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
