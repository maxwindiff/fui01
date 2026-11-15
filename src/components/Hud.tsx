import { useEffect, useRef } from "react";
import type { Scene } from "../gpu/scene";

// Reads the camera of a GPU view four times a second and draws the last sixty frame times as a strip.
export function Hud({ scene }: { scene: () => Scene | null | undefined }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const [brg, elv, zm] = el.current!.querySelectorAll("b");
    const cv = el.current!.querySelector("canvas")!;
    const g = cv.getContext("2d")!;
    const ink = getComputedStyle(el.current!).getPropertyValue("--accent-2") || "#fff";
    const hist: number[] = [];
    const deg = (r: number) => (r * 180) / Math.PI;
    const read = () => {
      const s = scene();
      if (!s) return;
      brg.textContent = `${String(Math.round(((deg(-s.cam.yaw) % 360) + 360) % 360)).padStart(3, "0")}°`;
      elv.textContent = `${String(Math.round(deg(s.cam.pitch))).padStart(2, "0")}°`;
      zm.textContent = `${s.cam.scale.toFixed(2)}x`;
      hist.push(s.frameMs);
      if (hist.length > 30) hist.shift();
      g.clearRect(0, 0, 60, 18);
      g.fillStyle = ink;
      hist.forEach((v, k) => {
        const h = Math.max(1, Math.min(18, (v / 33.3) * 18));
        g.globalAlpha = k === hist.length - 1 ? 1 : 0.45;
        g.fillRect(60 - (hist.length - k) * 2, 18 - h, 1, h);
      });
    };
    const id = setInterval(read, 250);
    return () => clearInterval(id);
  }, [scene]);
  return (
    <div className="viz-hud" ref={el} data-keepout>
      <span className="live">Live</span>
      <div>Bearing<b>000°</b></div>
      <div>Elevation<b>00°</b></div>
      <div>Zoom<b>1.00x</b></div>
      <div>Frame time<canvas width="60" height="18" /></div>
    </div>
  );
}
