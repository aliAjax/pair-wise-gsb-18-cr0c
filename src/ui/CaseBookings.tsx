// 单条牙位记录的显微会诊预约区。
import { useState } from "react";
import type { InstrumentCase } from "../domain/types";
import {
  needsMicroscopy,
  distanceText,
  type Violation,
} from "../domain/rules";
import { actions } from "../state/store";
import { MICRO_STATIONS, SLOTS } from "../domain/seed";
import { ViolationList, fmtTime } from "./format";

export function CaseBookings({ active }: { active: InstrumentCase }) {
  const [slot, setSlot] = useState(SLOTS[0]);
  const [station, setStation] = useState(MICRO_STATIONS[0]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [done, setDone] = useState(false);

  const mine = actions.getState().bookings.filter((b) => b.caseId === active.id);
  const eligible = needsMicroscopy(active.current);

  if (!eligible) {
    return (
      <div className="sub-panel muted-panel">
        <p className="sub-title">显微会诊</p>
        <p className="dim">
          当前 {distanceText(active.current)}，未达会诊指征（超出根尖或距根尖超过 3mm 才可预约）。
        </p>
      </div>
    );
  }

  function book() {
    const res = actions.book(active.id, slot, station);
    setViolations(res.violations);
    setDone(res.ok);
  }

  return (
    <div className="sub-panel">
      <p className="sub-title">
        显微会诊预约
        <span className="tag tag-danger">达到会诊指征</span>
      </p>

      {active.frozen ? (
        <p className="dim">记录已冻结，不再接受预约。</p>
      ) : (
        <div className="booking-create">
          <select value={slot} onChange={(e) => setSlot(e.target.value)}>
            {SLOTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={station} onChange={(e) => setStation(e.target.value)}>
            {MICRO_STATIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="primary-action small" onClick={book}>占用显微台</button>
        </div>
      )}

      <ViolationList items={violations} />
      {done && <p className="ok-line">预约成功。同一患者同一时段仅可占用一个显微台。</p>}

      {mine.length > 0 && (
        <ul className="booking-list">
          {mine.map((b) => (
            <li key={b.id} className={b.status === "released" ? "released" : ""}>
              <span className="booking-slot">{b.slot}</span>
              <span className="booking-station">{b.station}</span>
              <span className={`tag ${b.status === "booked" ? "tag-ok" : "tag-muted"}`}>
                {b.status === "booked" ? "生效中" : `已释放 ${fmtTime(b.releasedAt!)}`}
              </span>
              {b.status === "released" && b.releasedReason && (
                <span className="release-reason">{b.releasedReason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
