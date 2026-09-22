// 显微会诊台看板：按时段分组展示占用情况，支持「释放原时段」与「改期」。
// 改期在状态层原子完成：先释放原时段，再占新时段。
import { useState } from "react";
import type { AppState, MicroBooking } from "../domain/types";
import type { Violation } from "../domain/rules";
import { actions } from "../state/store";
import { MICRO_STATIONS, SLOTS } from "../domain/seed";
import { ViolationList, fmtTime } from "./format";

export function MicroBoard({ state }: { state: AppState }) {
  const slots = Array.from(new Set([...SLOTS, ...state.bookings.map((b) => b.slot)])).sort();
  const caseById = new Map(state.cases.map((c) => [c.id, c]));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>显微会诊台排期</p>
          <h2>时段占用板</h2>
        </div>
        <p className="dim heading-note">同一患者同一时段只能占一个显微台；改期先释放原时段</p>
      </div>

      <div className="slots-grid">
        {slots.map((slot) => {
          const inSlot = state.bookings.filter((b) => b.slot === slot);
          const active = inSlot.filter((b) => b.status === "booked");
          return (
            <div key={slot} className={`slot-col ${active.length > 1 ? "slot-conflict" : ""}`}>
              <h4>{slot}</h4>
              {inSlot.length === 0 && <p className="dim">空闲</p>}
              {inSlot.map((b) => (
                <BookingRow key={b.id} booking={b} toothNo={caseById.get(b.caseId)?.current.toothNo ?? "—"} />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BookingRow({ booking, toothNo }: { booking: MicroBooking; toothNo: string }) {
  const [mode, setMode] = useState<"none" | "release" | "reschedule">("none");
  const [reason, setReason] = useState("");
  const [newSlot, setNewSlot] = useState(SLOTS.find((s) => s !== booking.slot) ?? booking.slot);
  const [newStation, setNewStation] = useState(
    MICRO_STATIONS.find((s) => s !== booking.station) ?? booking.station,
  );
  const [violations, setViolations] = useState<Violation[]>([]);

  if (booking.status === "released") {
    return (
      <div className="booking-row released-row">
        <div>
          <s>{booking.station} · {booking.patientName} · {toothNo}</s>
          <small>已释放 {fmtTime(booking.releasedAt!)}</small>
          {booking.releasedReason && <small className="release-reason">{booking.releasedReason}</small>}
        </div>
      </div>
    );
  }

  function doRelease() {
    const res = actions.releaseBooking(booking.id, reason);
    setViolations(res.violations);
    if (res.ok) {
      setMode("none");
      setReason("");
    }
  }

  function doReschedule() {
    const res = actions.reschedule(booking.id, newSlot, newStation);
    setViolations(res.violations);
    if (res.ok) setMode("none");
  }

  return (
    <div className="booking-row">
      <div className="booking-row-head">
        <strong>{booking.station}</strong>
        <span>{booking.patientName} · {toothNo}</span>
      </div>
      <ViolationList items={violations} />
      {mode === "none" && (
        <div className="row-actions">
          <button className="small" onClick={() => setMode("reschedule")}>改期</button>
          <button className="small" onClick={() => setMode("release")}>释放原时段</button>
        </div>
      )}
      {mode === "release" && (
        <div className="inline-form">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="释放/改期原因 *"
          />
          <div className="row-actions">
            <button className="small primary-action" onClick={doRelease}>确认释放</button>
            <button className="small" onClick={() => setMode("none")}>取消</button>
          </div>
        </div>
      )}
      {mode === "reschedule" && (
        <div className="inline-form">
          <p className="dim">改期将先释放原时段，再占用新时段（一步完成）。</p>
          <select value={newSlot} onChange={(e) => setNewSlot(e.target.value)}>
            {SLOTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={newStation} onChange={(e) => setNewStation(e.target.value)}>
            {MICRO_STATIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="row-actions">
            <button className="small primary-action" onClick={doReschedule}>确认改期</button>
            <button className="small" onClick={() => setMode("none")}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
