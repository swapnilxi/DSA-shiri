"use client";
import { useEffect, useRef } from "react";

interface Props {
  active: boolean;
  volume: number;
  color: string;
}

export function Waveform({ active, volume, color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (!active) {
        // flat line
        ctx.beginPath();
        ctx.strokeStyle = color + "44";
        ctx.lineWidth = 2;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      phaseRef.current += 0.08;
      const amp = (volume * H) / 2.2;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      for (let x = 0; x <= W; x++) {
        const t = (x / W) * Math.PI * 6;
        const y = H / 2 + Math.sin(t + phaseRef.current) * amp
          + Math.sin(t * 2.3 + phaseRef.current * 1.4) * amp * 0.4;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, volume, color]);

  return <canvas ref={canvasRef} width={240} height={60} className="rounded-lg" />;
}
