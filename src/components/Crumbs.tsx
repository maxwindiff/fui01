import { useEffect, useState } from "react";
import { entity } from "../data";
import { PANEL_TITLES } from "../panels";
import { useWorkspace } from "../workspace";

// The panel under the middle of the viewport, which the breadcrumb names while the board scrolls.
function useSection(active: boolean) {
  const [section, setSection] = useState("");
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = innerHeight * 0.4;
      for (const el of document.querySelectorAll<HTMLElement>("[data-panel]")) {
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) { setSection(el.dataset.panel!); return; }
      }
      setSection("");
    };
    const queue = () => { raf ||= requestAnimationFrame(update); };
    update();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", queue);
      removeEventListener("resize", queue);
    };
  }, [active]);
  return section;
}

export function Crumbs({ root }: { root: string }) {
  const ws = useWorkspace();
  const section = useSection(!ws.stage);
  const fig = ws.stage ?? section;
  const last = ws.trail.length - 1;
  const panelHere = fig && !ws.trail.length;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <button type="button" aria-current={!fig && !ws.trail.length ? "page" : undefined} onClick={ws.home}>{root}</button>
        </li>
        {fig ? (
          <li>
            <button
              type="button" aria-current={panelHere ? "page" : undefined}
              onClick={() => (ws.stage ? ws.closeInspector() : ws.reveal(fig))}
            >{PANEL_TITLES[fig]}</button>
          </li>
        ) : null}
        {ws.trail.map((id, i) => (
          <li key={`${id}${i}`}>
            <button type="button" aria-current={i === last ? "page" : undefined} onClick={() => ws.jump(i)}>{entity(id)!.name}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
