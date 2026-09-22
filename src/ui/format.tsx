// 界面层共享的纯展示工具。
import type { Violation } from "../domain/rules";

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ViolationList({ items }: { items: Violation[] }) {
  if (!items.length) return null;
  return (
    <ul className="violation-list">
      {items.map((v, i) => (
        <li key={`${v.code}-${i}`}>
          <b>{v.code}</b> {v.message}
        </li>
      ))}
    </ul>
  );
}
