import type { Theme } from "../themes";

export function MotionSheet({ theme, onReplay }: { theme: Theme; onReplay: () => void }) {
  const m = theme.motion;
  const [x1, y1, x2, y2] = m.ease.match(/-?[\d.]+/g)!.map(Number);
  const S = 120;
  return (
    <div className="motion">
      <div className="motion-curve">
        <svg viewBox={`-6 -6 ${S + 12} ${S + 12}`} role="img" aria-label={`Easing curve ${m.ease}`}>
          <path className="c-axis" d={`M0 0V${S}H${S}`} />
          <path className="c-rule" d={`M0 ${S}L${S} 0`} />
          <path className="c-line" pathLength={1} d={`M0 ${S}C${x1 * S} ${S - y1 * S} ${x2 * S} ${S - y2 * S} ${S} 0`} />
        </svg>
        <p className="note">Shared easing. Entries take {m.enter} ms a panel, {m.stagger} ms apart. Responses to the pointer take {m.hover} ms.</p>
        <button type="button" className="btn" onClick={onReplay}>Replay entry</button>
      </div>
      <dl className="motion-list">
        {m.notes.map((n) => (
          <div key={n.name}>
            <dt>{n.name}</dt>
            <dd>{n.what}</dd>
            <dd className="num">{n.timing}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
