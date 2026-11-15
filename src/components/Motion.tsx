import { INTERACTIONS } from "../themes";
import type { Theme } from "../themes";

export function MotionSheet({ theme, onReplay, onRun }: { theme: Theme; onReplay: () => void; onRun: (command: string) => void }) {
  const m = theme.motion;
  const S = 120;
  const stepped = m.ease.match(/^steps\((\d+)/);
  const [x1, y1, x2, y2] = m.ease.match(/-?[\d.]+/g)!.map(Number);
  const curve = stepped
    ? `M0 ${S}` + Array.from({ length: +stepped[1] }, (_, i) => `H${((i + 1) / +stepped[1]) * S}V${S - ((i + 1) / +stepped[1]) * S}`).join("")
    : `M0 ${S}C${x1 * S} ${S - y1 * S} ${x2 * S} ${S - y2 * S} ${S} 0`;
  return (
    <div className="motion">
      <div className="motion-curve">
        <svg viewBox={`-6 -6 ${S + 12} ${S + 12}`} role="img" aria-label={`Easing curve ${m.ease}`}>
          <path className="c-axis" d={`M0 0V${S}H${S}`} />
          <path className="c-rule" d={`M0 ${S}L${S} 0`} />
          <path className="c-line" pathLength={1} d={curve} />
        </svg>
        <p className="note">Entry {m.enter} ms, layout {m.layout} ms, response {m.hover} ms</p>
        <button type="button" className="btn" onClick={onReplay}>Replay entry</button>
      </div>
      <div>
        <h4 className="sub-h">Entry and rest</h4>
        <dl className="motion-list">
          {m.notes.map((n) => (
            <div key={n.name}>
              <dt>{n.name}</dt>
              <dd>{n.what}</dd>
              <dd className="num">{n.timing}</dd>
            </div>
          ))}
        </dl>
        <h4 className="sub-h">Response</h4>
        <dl className="motion-list">
          {INTERACTIONS.map((n) => (
            <div key={n.name}>
              <dt>{n.name}</dt>
              <dd>{n.what}</dd>
              <dd className="num">{n.timing(m)}</dd>
              {n.action ? <dd><button type="button" className="btn" onClick={() => onRun(n.action!.run)}>{n.action.label}</button></dd> : null}
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
