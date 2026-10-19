// Lightweight, high-performance Canvas 2D Decision Visualizer
// Reacts to USABLE (green), DEGRADED (amber), REACQUIRE (red)
// Zero external libraries, silky smooth 60fps

let animId = null;

export function initResultCanvas(decision) {
  const canvas = document.getElementById("result-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const colorConfig = {
    USABLE: { stroke: "#58e3a6", glow: "rgba(88, 227, 166, 0.45)", waveNoise: 1 },
    DEGRADED: { stroke: "#ffc45b", glow: "rgba(255, 196, 91, 0.45)", waveNoise: 5 },
    REACQUIRE: { stroke: "#ff6176", glow: "rgba(255, 97, 118, 0.55)", waveNoise: 14 }
  };
  const theme = colorConfig[decision] || colorConfig.USABLE;

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    width = canvas.clientWidth || 480;
    height = canvas.clientHeight || 240;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const particleCount = 35;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.8,
      alpha: Math.random() * 0.4 + 0.2
    });
  }

  let time = 0;

  function render() {
    ctx.clearRect(0, 0, width, height);

    // 1. Draw subtle ambient particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!reducedMotion) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = theme.stroke + "33";
      ctx.fill();
    }

    // 2. Dynamic waveform across center
    const centerY = height * 0.5;
    const points = 140;
    const step = width / points;

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const x = i * step;
      let y = centerY;

      if (decision === "USABLE") {
        // Clean rhythmic heartbeat
        const beatCycle = ((i * 1.6 - time * 24) % 100 + 100) % 100;
        if (beatCycle >= 20 && beatCycle <= 30) {
          const qrs = (beatCycle - 25) / 2.2;
          y -= Math.exp(-qrs * qrs) * 55;
        } else if (beatCycle >= 35 && beatCycle <= 46) {
          const t = (beatCycle - 40) / 3;
          y -= Math.exp(-t * t) * 16;
        }
        y += Math.sin(i * 0.15 + time) * 2;
      } else if (decision === "DEGRADED") {
        // Distorted waveform with wander and moderate noise
        const beatCycle = ((i * 1.6 - time * 20) % 100 + 100) % 100;
        if (beatCycle >= 20 && beatCycle <= 30) {
          const qrs = (beatCycle - 25) / 3.0;
          y -= Math.exp(-qrs * qrs) * 35;
        }
        y += Math.sin(i * 0.08 + time * 0.6) * 12; // wander
        y += (Math.sin(i * 1.9 + time * 3) + Math.cos(i * 0.7 - time)) * 4;
      } else {
        // REACQUIRE: Severe corrupted signal / noise
        y += Math.sin(i * 0.2 + time) * 15;
        y += (Math.sin(i * 3.4 + time * 5) * 16) + (Math.cos(i * 1.7 - time * 2) * 12);
        if (i % 15 === 0) {
          y += (Math.random() - 0.5) * 24;
        }
      }

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!reducedMotion) {
      time += 0.025;
      animId = requestAnimationFrame(render);
    }
  }

  animId = requestAnimationFrame(render);
}
