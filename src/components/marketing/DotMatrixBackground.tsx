import { useEffect, useRef } from "react";

interface Dot {
  bx: number;
  by: number;
  r: number;
  op: number;
  phase: number;
  sx: number;
  sy: number;
  ax: number;
  ay: number;
}

export default function DotMatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let dots: Dot[] = [];
    let animId = 0;

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
      initDots();
    }

    function initDots() {
      dots = [];

      // LEFT side: scattered, sparse, random sizes, lots of movement
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * W * 0.25;
        const fade = 1 - x / (W * 0.25);
        dots.push({
          bx: x,
          by: Math.random() * H,
          r: 0.8 + Math.random() * 2.5,
          op: (0.05 + Math.random() * 0.12) * fade,
          phase: Math.random() * Math.PI * 2,
          sx: 0.3 + Math.random() * 0.8,
          sy: 0.2 + Math.random() * 0.6,
          ax: 4 + Math.random() * 14,
          ay: 3 + Math.random() * 10,
        });
      }

      // RIGHT side: scattered dots, smaller, less movement
      for (let i = 0; i < 80; i++) {
        const x = W * 0.76 + Math.random() * W * 0.24;
        const fade = (x - W * 0.76) / (W * 0.24);
        dots.push({
          bx: x,
          by: Math.random() * H,
          r: 0.6 + Math.random() * 1.8,
          op: (0.04 + Math.random() * 0.1) * fade,
          phase: Math.random() * Math.PI * 2,
          sx: 0.1 + Math.random() * 0.25,
          sy: 0.08 + Math.random() * 0.2,
          ax: 1 + Math.random() * 4,
          ay: 0.8 + Math.random() * 3,
        });
      }

      // RIGHT side: small cluster groups
      const clusters = 6 + Math.floor(Math.random() * 6);
      for (let ci = 0; ci < clusters; ci++) {
        const cx = W * 0.8 + Math.random() * W * 0.18;
        const cy = Math.random() * H;
        const cw = 15 + Math.random() * 50;
        const ch = 8 + Math.random() * 25;
        const count = 3 + Math.floor(Math.random() * 8);
        const fade = (cx - W * 0.76) / (W * 0.24);
        for (let d = 0; d < count; d++) {
          dots.push({
            bx: cx + Math.random() * cw,
            by: cy + Math.random() * ch,
            r: 0.6 + Math.random() * 1,
            op: (0.06 + Math.random() * 0.08) * fade,
            phase: Math.random() * Math.PI * 2,
            sx: 0.04 + Math.random() * 0.1,
            sy: 0.03 + Math.random() * 0.08,
            ax: 0.5 + Math.random() * 1.5,
            ay: 0.3 + Math.random() * 1,
          });
        }
      }
    }

    let t = 0;
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      t += 0.016;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const x = d.bx + Math.sin(t * d.sx + d.phase) * d.ax;
        const y = d.by + Math.cos(t * d.sy + d.phase * 0.7) * d.ay;
        const pulse = 0.4 + Math.sin(t * 0.3 + d.phase) * 0.6;
        const a = d.op * pulse;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255," + a + ")";
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}