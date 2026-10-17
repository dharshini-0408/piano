import React, { useEffect, useRef } from "react";

// A moonlit, candlelit wizarding-school backdrop: a twinkling night sky
// and drifting sparkles on canvas, with a CSS castle silhouette and
// gently bobbing floating candles (real 3D depth via translateZ/rotate).
export default function Background3D() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 130 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.7,
      r: Math.random() * 1.4 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.02,
    }));

    const sparkles = Array.from({ length: 22 }, () => ({
      x: Math.random(),
      y: 0.2 + Math.random() * 0.6,
      r: Math.random() * 1.6 + 0.6,
      drift: 0.00015 + Math.random() * 0.0003,
      angle: Math.random() * Math.PI * 2,
      hue: 40 + Math.random() * 20,
    }));

    let t = 0;
    function draw() {
      t += 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Twinkling stars
      stars.forEach((s) => {
        const twinkle = 0.4 + Math.sin(t * s.speed + s.phase) * 0.35 + 0.35;
        ctx.beginPath();
        ctx.fillStyle = `rgba(240, 230, 255, ${Math.max(0, twinkle)})`;
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Drifting golden sparkles (floo-dust motes)
      sparkles.forEach((p) => {
        p.angle += p.drift * 20;
        const x = p.x * w + Math.cos(p.angle) * 18;
        const y = p.y * h + Math.sin(t * p.drift) * 40;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, p.r * 6);
        glow.addColorStop(0, `hsla(${p.hue}, 90%, 70%, 0.55)`);
        glow.addColorStop(1, `hsla(${p.hue}, 90%, 60%, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const candles = [
    { left: "8%", top: "14%", delay: "0s", scale: 0.9 },
    { left: "18%", top: "30%", delay: "1.1s", scale: 0.7 },
    { left: "82%", top: "12%", delay: "0.6s", scale: 1 },
    { left: "90%", top: "32%", delay: "1.7s", scale: 0.75 },
    { left: "50%", top: "8%", delay: "0.3s", scale: 0.65 },
    { left: "68%", top: "24%", delay: "2s", scale: 0.85 },
  ];

  return (
    <div className="bg3d">
      <canvas ref={canvasRef} className="bg3d-canvas" />

      <div className="bg3d-moon" />

      <div className="bg3d-candles">
        {candles.map((c, i) => (
          <div
            key={i}
            className="candle"
            style={{ left: c.left, top: c.top, animationDelay: c.delay, "--scale": c.scale }}
          >
            <span className="candle-flame" />
            <span className="candle-glow" />
            <span className="candle-body" />
          </div>
        ))}
      </div>

      <div className="bg3d-castle" />
      <div className="bg3d-mist" />
      <div className="bg3d-vignette" />
    </div>
  );
}
