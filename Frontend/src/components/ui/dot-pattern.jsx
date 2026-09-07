import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Enhanced Full-Screen Interactive Animated Dot Pattern
 * Features:
 * - Fluid multi-frequency continuous ambient waves
 * - Window-wide pointer tracking with buttery-smooth lerp physics
 * - Click / tap shockwave ripples across dots
 * - Soft radial bloom & proximity glow
 * - Dynamic Light / Dark mode color adaptation
 * - Retina DPR crispness & responsive resizing
 */
export function DotPattern({
  className,
  children,
  dotSize = 2.5,
  gap = 28,
  baseColor,
  glowColor,
  secondaryGlowColor,
  proximity = 150,
  glowIntensity = 1.6,
  waveSpeed = 1.2,
  interactive = true,
  rippleOnClick = true,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dotsRef = useRef([]);
  const ripplesRef = useRef([]);
  const animationRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Mouse positions: target (instant) vs current (smooth lerp)
  const targetMouseRef = useRef({ x: -2000, y: -2000, active: false });
  const currentMouseRef = useRef({ x: -2000, y: -2000 });

  // Detect dark mode automatically
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Theme-aware default colors (Powder Blue + Mint palette)
  const resolvedBaseColor = useMemo(() => {
    if (baseColor) return baseColor;
    return isDark ? "#475569" : "#94A3B8"; // Slate 600 in dark, Slate 400 in light
  }, [baseColor, isDark]);

  const resolvedGlowColor = useMemo(() => {
    if (glowColor) return glowColor;
    return isDark ? "#38BDF8" : "#0284C7"; // Powder 400 in dark, Powder 600 in light
  }, [glowColor, isDark]);

  const resolvedSecondaryGlowColor = useMemo(() => {
    if (secondaryGlowColor) return secondaryGlowColor;
    return isDark ? "#34D399" : "#10B981"; // Mint 400 in dark, Mint 500 in light
  }, [secondaryGlowColor, isDark]);

  const baseRgb = useMemo(() => hexToRgb(resolvedBaseColor), [resolvedBaseColor]);
  const glowRgb = useMemo(() => hexToRgb(resolvedGlowColor), [resolvedGlowColor]);
  const secondaryGlowRgb = useMemo(
    () => hexToRgb(resolvedSecondaryGlowColor),
    [resolvedSecondaryGlowColor]
  );

  // Grid builder
  const buildGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cellSize = dotSize + gap;
    const cols = Math.ceil(width / cellSize) + 2;
    const rows = Math.ceil(height / cellSize) + 2;

    const totalWidth = (cols - 1) * cellSize;
    const totalHeight = (rows - 1) * cellSize;
    const offsetX = (width - totalWidth) / 2;
    const offsetY = (height - totalHeight) / 2;

    const dots = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        dots.push({
          x: offsetX + col * cellSize,
          y: offsetY + row * cellSize,
          baseOpacity: isDark ? 0.22 : 0.35,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap, isDark]);

  // Main animation frame loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Reset transform to support high DPR crisp rendering
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Smooth cursor interpolation (lerp)
    const target = targetMouseRef.current;
    const current = currentMouseRef.current;
    if (target.active) {
      current.x += (target.x - current.x) * 0.14;
      current.y += (target.y - current.y) * 0.14;
    } else {
      // Drift away smoothly when pointer leaves
      current.x += (-2000 - current.x) * 0.05;
      current.y += (-2000 - current.y) * 0.05;
    }

    const mx = current.x;
    const my = current.y;
    const proximitySq = proximity * proximity;

    const elapsed = (Date.now() - startTimeRef.current) * 0.001;
    const time = elapsed * waveSpeed;

    // Update ripples
    const now = performance.now();
    ripplesRef.current = ripplesRef.current.filter((ripple) => {
      const age = now - ripple.startTime;
      return age < ripple.duration;
    });

    const activeRipples = ripplesRef.current.map((r) => {
      const progress = (now - r.startTime) / r.duration;
      return {
        x: r.x,
        y: r.y,
        currentRadius: progress * r.maxRadius,
        strength: (1 - progress) * r.intensity,
        thickness: 40,
      };
    });

    const baseRadius = dotSize / 2;

    for (let i = 0; i < dotsRef.current.length; i++) {
      const dot = dotsRef.current[i];

      // Multi-frequency undulating wave
      const wave1 = Math.sin(dot.x * 0.012 + dot.y * 0.012 + time * 1.4 + dot.phase * 0.2);
      const wave2 = Math.cos(dot.x * 0.008 - dot.y * 0.008 + time * 0.9);
      const combinedWave = (wave1 + wave2) * 0.5; // [-1, 1]
      const normalizedWave = combinedWave * 0.5 + 0.5; // [0, 1]

      // Base wave modulation
      let radius = baseRadius * (1 + normalizedWave * 0.75); // visibly pulses
      let opacity = dot.baseOpacity + normalizedWave * 0.3; // clearly brightens and dims

      let r = Math.round(baseRgb.r + (glowRgb.r - baseRgb.r) * (normalizedWave * 0.25));
      let g = Math.round(baseRgb.g + (glowRgb.g - baseRgb.g) * (normalizedWave * 0.25));
      let b = Math.round(baseRgb.b + (glowRgb.b - baseRgb.b) * (normalizedWave * 0.25));
      let glow = 0;

      // Ripple interaction
      if (activeRipples.length > 0) {
        for (let j = 0; j < activeRipples.length; j++) {
          const rip = activeRipples[j];
          const rdx = dot.x - rip.x;
          const rdy = dot.y - rip.y;
          const dist = Math.sqrt(rdx * rdx + rdy * rdy);
          const diff = Math.abs(dist - rip.currentRadius);

          if (diff < rip.thickness) {
            const rippleFactor = (1 - diff / rip.thickness) * rip.strength;
            radius += rippleFactor * 2.5;
            opacity = Math.min(1, opacity + rippleFactor * 0.6);
            glow = Math.max(glow, rippleFactor * 1.5);

            // Shift towards secondary glow color (mint)
            r = Math.round(r + (secondaryGlowRgb.r - r) * rippleFactor);
            g = Math.round(g + (secondaryGlowRgb.g - g) * rippleFactor);
            b = Math.round(b + (secondaryGlowRgb.b - b) * rippleFactor);
          }
        }
      }

      // Mouse proximity interaction
      if (interactive) {
        const dx = dot.x - mx;
        const dy = dot.y - my;
        const distSq = dx * dx + dy * dy;

        if (distSq < proximitySq) {
          const dist = Math.sqrt(distSq);
          const t = 1 - dist / proximity;
          const smoothT = t * t * (3 - 2 * t); // Smoothstep curve

          // Blend between primary glow (powder blue) and secondary glow (mint)
          const mix = Math.sin(time * 2 + dist * 0.05) * 0.5 + 0.5;
          const targetR = glowRgb.r * (1 - mix) + secondaryGlowRgb.r * mix;
          const targetG = glowRgb.g * (1 - mix) + secondaryGlowRgb.g * mix;
          const targetB = glowRgb.b * (1 - mix) + secondaryGlowRgb.b * mix;

          r = Math.round(r + (targetR - r) * smoothT);
          g = Math.round(g + (targetG - g) * smoothT);
          b = Math.round(b + (targetB - b) * smoothT);

          opacity = Math.min(1, opacity + smoothT * 0.7);
          radius += smoothT * 2.2;
          glow += smoothT * glowIntensity;
        }
      }

      // Radial bloom glow behind active dots
      if (glow > 0.15) {
        const glowRadius = Math.max(radius * 4, 8);
        const glowGrad = ctx.createRadialGradient(
          dot.x,
          dot.y,
          0,
          dot.x,
          dot.y,
          glowRadius
        );
        glowGrad.addColorStop(
          0,
          `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${Math.min(0.45, glow * 0.28)})`
        );
        glowGrad.addColorStop(
          0.6,
          `rgba(${secondaryGlowRgb.r}, ${secondaryGlowRgb.g}, ${secondaryGlowRgb.b}, ${Math.min(0.15, glow * 0.1)})`
        );
        glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // Core dot circle
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, Math.max(0.6, radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, opacity))})`;
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [
    dotSize,
    proximity,
    baseRgb,
    glowRgb,
    secondaryGlowRgb,
    glowIntensity,
    waveSpeed,
    interactive,
  ]);

  // Window pointer listeners (tracks across whole page without being blocked by child elements)
  useEffect(() => {
    if (!interactive) return;

    const handlePointerMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      targetMouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handlePointerLeave = () => {
      targetMouseRef.current.active = false;
    };

    const handleClick = (e) => {
      if (!rippleOnClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      ripplesRef.current.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        startTime: performance.now(),
        duration: 900,
        maxRadius: 280,
        intensity: 1.8,
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave);
    window.addEventListener("pointerdown", handleClick, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("pointerdown", handleClick);
    };
  }, [interactive, rippleOnClick]);

  // Resize and initialize grid
  useEffect(() => {
    buildGrid();

    const container = containerRef.current;
    let resizeObserver;
    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        buildGrid();
      });
      resizeObserver.observe(container);
    }

    const handleWindowResize = () => buildGrid();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [buildGrid]);

  // Start continuous rendering loop
  useEffect(() => {
    startTimeRef.current = Date.now();
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
      />

      {/* Modern edge-feathering radial mask to blend gracefully into viewport */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(circle at center, transparent 35%, rgba(11, 15, 25, 0.45) 80%, rgba(11, 15, 25, 0.85) 100%)"
            : "radial-gradient(circle at center, transparent 40%, rgba(248, 250, 252, 0.45) 80%, rgba(248, 250, 252, 0.85) 100%)",
        }}
      />

      {children && (
        <div className="relative z-10 pointer-events-auto h-full w-full">
          {children}
        </div>
      )}
    </div>
  );
}

export default DotPattern;
