import "./styles.css";
import { useMemo } from "react";
import { useAppState, actions } from "./state/store";
import { checkConsistency } from "./domain/rules";
import { MetricBar } from "./ui/MetricBar";
import { CaseForm } from "./ui/CaseForm";
import { CaseCard } from "./ui/CaseCard";
import { MicroBoard } from "./ui/MicroBoard";
import { ConflictPanel } from "./ui/ConflictPanel";

const RULE_BOOK = [
  { code: "R1", text: "超出根尖或距根尖超过三毫米，转显微会诊" },
  { code: "R2", text: "封药或充填后禁止补记" },
  { code: "R3", text: "同一患者同一时段只能占一个显微台" },
  { code: "R4", text: "改期先释放原时段" },
  { code: "R5", text: "处置完成冻结；返工生成带原因版本并保留旧值" },
];

function App() {
  const state = useAppState();
  const consistencyErrors = useMemo(() => checkConsistency(state), [state]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · port 5104 · 牙体牙髓</p>
          <h1>根管分离器械处置台</h1>
          <p className="subtitle">
            按牙位记录根管、距根尖距离、分离器械与处置方案；封药/充填后锁定补记，
            超出根尖或距根尖超过 3mm 转显微会诊；完成即冻结，返工生成带原因的新版本。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>领域数据 / 校验 / 界面三层独立 · 不增加依赖 · localStorage 持久化</span>
        </div>
      </section>

      <MetricBar state={state} />

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            <span>牙体牙髓医生</span>
            <span>椅旁助理</span>
            <span>显微会诊协调员</span>
          </div>
          <h2>处置规则</h2>
          <ul className="rule-book">
            {RULE_BOOK.map((r) => (
              <li key={r.code}>
                <b>{r.code}</b>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
          <h2>数据</h2>
          <div className="data-actions">
            <button onClick={() => actions.resetSeed()}>重置为示例数据</button>
          </div>
          <p className="dim small-note">
            数据实时写入浏览器存储，刷新后牙位、处置、预约与版本保持一致。
          </p>
          {consistencyErrors.length > 0 && (
            <div className="consistency-bad">
              <b>一致性异常</b>
              <ul>
                {consistencyErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="main-col">
          <CaseForm />
          <section className="panel records-panel">
            <div className="section-heading">
              <div>
                <p>牙位 · 根管 · 距离 · 器械 · 方案</p>
                <h2>分离器械处置记录（{state.cases.length}）</h2>
              </div>
            </div>
            <div className="case-list">
              {state.cases.map((c) => (
                <CaseCard key={c.id} active={c} />
              ))}
            </div>
          </section>
        </div>
      </section>

      <MicroBoard state={state} />
      <ConflictPanel state={state} />

      <footer className="app-footer">
        <span>牙位记录数：{state.cases.length}</span>
        <span>处置记录流水：{state.cases.reduce((n, c) => n + c.entries.length, 0)}</span>
        <span>预约：{state.bookings.filter((b) => b.status === "booked").length} 生效 / {state.bookings.filter((b) => b.status === "released").length} 已释放</span>
        <span>版本：{state.cases.reduce((n, c) => n + c.generations.length, 0)}</span>
        <span className={consistencyErrors.length ? "danger-text" : "ok-text"}>
          {consistencyErrors.length ? "一致性核对未通过" : "牙位/处置/预约/版本一致 ✓"}
        </span>
      </footer>
    </main>
  );
}

export default App;
