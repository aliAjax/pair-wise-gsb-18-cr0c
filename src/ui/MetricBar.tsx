// 顶部指标条：由当前状态实时计算。
import type { AppState } from "../domain/types";
import { needsMicroscopy } from "../domain/rules";

interface Metric {
  label: string;
  value: number;
  hint: string;
  tone: "ok" | "watch" | "danger";
}

export function MetricBar({ state }: { state: AppState }) {
  const cases = state.cases;
  const metrics: Metric[] = [
    {
      label: "处置中",
      value: cases.filter((c) => !c.frozen && c.current.stage === "open").length,
      hint: "未封药、未冻结",
      tone: "ok",
    },
    {
      label: "封药 / 充填",
      value: cases.filter((c) => !c.frozen && c.current.stage !== "open").length,
      hint: "封药或充填后禁补记",
      tone: "watch",
    },
    {
      label: "待显微会诊",
      value: cases.filter((c) => needsMicroscopy(c.current)).length,
      hint: "超出根尖或距根尖>3mm",
      tone: "danger",
    },
    {
      label: "生效显微预约",
      value: state.bookings.filter((b) => b.status === "booked").length,
      hint: "同一患者同时段限一个台",
      tone: "ok",
    },
    {
      label: "已冻结记录",
      value: cases.filter((c) => c.frozen).length,
      hint: "返工生成新版本",
      tone: "watch",
    },
  ];

  return (
    <section className="metrics-grid metrics-5">
      {metrics.map((m) => (
        <article key={m.label} className={`metric-card tone-${m.tone}`}>
          <span>{m.label}</span>
          <strong>{m.value}</strong>
          <p className="metric-hint">{m.hint}</p>
          <i className={`status-${m.tone}`} />
        </article>
      ))}
    </section>
  );
}
