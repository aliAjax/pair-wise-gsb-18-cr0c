// 冲突清单：每行固定列出 牙位 / 根管 / 距离 / 时段 / 命中规则。
import { evaluateConflicts } from "../domain/rules";
import type { AppState } from "../domain/types";

const codeLabel: Record<string, string> = {
  R1: "转会诊",
  R2: "补记拦截",
  R3: "双台冲突",
  R4: "释放异常",
  R5: "冻结返工",
};

export function ConflictPanel({ state }: { state: AppState }) {
  const rows = evaluateConflicts(state);

  return (
    <section className="panel conflicts-panel">
      <div className="section-heading">
        <div>
          <p>规则核对</p>
          <h2>冲突与风险清单</h2>
        </div>
        <span className={`count-pill ${rows.length ? "count-bad" : "count-ok"}`}>
          {rows.length} 项
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="dim">当前无冲突：牙位、根管、距离、时段均符合规则。</p>
      ) : (
        <div className="table-wrap">
          <table className="conflict-table">
            <thead>
              <tr>
                <th>牙位</th>
                <th>根管</th>
                <th>距离</th>
                <th>时段</th>
                <th>规则</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} className={`row-${r.code.toLowerCase()}`}>
                  <td>{r.toothNo}</td>
                  <td>{r.canal}</td>
                  <td className={r.code === "R1" ? "danger-text" : ""}>{r.distanceText}</td>
                  <td>{r.slot}</td>
                  <td>
                    <span className={`rule-badge rule-${r.code.toLowerCase()}`}>
                      {codeLabel[r.code]}
                    </span>
                    <span className="rule-text">{r.rule}</span>
                  </td>
                  <td className="detail-cell">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
