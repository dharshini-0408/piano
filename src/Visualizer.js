import React, { useEffect, useRef } from "react";
import { getAnalyser } from "./synth";

export default function Visualizer({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      raf = requestAnimationFrame(draw);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      let analyser = null;
      try {
        analyser = getAnalyser();
      } catch (e) {
        analyser = null;
      }

      if (!analyser) return;

      const bufferLength = analyser.frequencyBinCount;
      const data = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(data);

      const barCount = 56;
      const step = Math.floor(bufferLength / barCount);
      const barWidth = w / barCount;

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        const avg = sum / step;
        const barHeight = (avg / 255) * h;
        const hue = 36 + (i / barCount) * 20;
        const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
        grad.addColorStop(0, `hsla(${hue}, 90%, 68%, 0.95)`);
        grad.addColorStop(1, `hsla(${hue}, 80%, 40%, 0.3)`);
        ctx.fillStyle = grad;
        const x = i * barWidth + 1;
        const bw = barWidth - 2;
        const bh = Math.max(2, barHeight);
        const r = Math.min(4, bw / 2);
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, h - bh + r);
        ctx.arcTo(x, h - bh, x + r, h - bh, r);
        ctx.lineTo(x + bw - r, h - bh);
        ctx.arcTo(x + bw, h - bh, x + bw, h - bh + r, r);
        ctx.lineTo(x + bw, h);
        ctx.closePath();
        ctx.fill();
      }
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className={`visualizer${active ? " visualizer-active" : ""}`}>
      <canvas ref={canvasRef} className="visualizer-canvas" />
    </div>
  );
}
