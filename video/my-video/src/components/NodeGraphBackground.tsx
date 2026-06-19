import { useMemo } from "react";
import { useCurrentFrame } from "remotion";

type Props = {
  className?: string;
  density?: number;
  speed?: number;
  linkDistance?: number;
  colors?: string[];
  linkColor?: string;
  hoverDistance?: number;
  baseOpacity?: number;
  seed?: number;
};

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
};

const DEFAULT_COLORS = ["#a78bfa", "#f0abfc", "#67e8f9"];

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hexToRgba = (hex: string, alpha: number): string => {
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
};

export const NodeGraphBackground = ({
  className,
  density = 60,
  speed = 0.035,
  linkDistance = 100,
  colors = DEFAULT_COLORS,
  linkColor = "#7c3aed",
  baseOpacity = 0.45,
  seed = 1,
}: Props) => {
  const frame = useCurrentFrame();

  const nodes: Node[] = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: density }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      vx: (rand() - 0.5) * speed * 2,
      vy: (rand() - 0.5) * speed * 2,
      r: 1 + rand() * 1.6,
      color: colors[Math.floor(rand() * colors.length)] ?? colors[0]!,
    }));
  }, [density, speed, colors, seed]);

  const positionedNodes = useMemo(
    () =>
      nodes.map((n) => {
        let x = n.x + n.vx * frame;
        let y = n.y + n.vy * frame;
        while (x < -5) x += 110;
        while (x > 105) x -= 110;
        while (y < -5) y += 110;
        while (y > 105) y -= 110;
        return { ...n, x, y };
      }),
    [nodes, frame],
  );

  const links: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
    opacity: number;
  }> = [];
  for (let i = 0; i < positionedNodes.length; i++) {
    for (let j = i + 1; j < positionedNodes.length; j++) {
      const a = positionedNodes[i]!;
      const b = positionedNodes[j]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      const linkDistPct = (linkDistance / 1920) * 100;
      if (dist < linkDistPct) {
        const proximity = 1 - dist / linkDistPct;
        links.push({
          a: { x: a.x, y: a.y },
          b: { x: b.x, y: b.y },
          opacity: Math.min(1, proximity) * baseOpacity,
        });
      }
    }
  }

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {links.map((l, i) => (
          <line
            key={`link-${i}`}
            x1={l.a.x}
            y1={l.a.y}
            x2={l.b.x}
            y2={l.b.y}
            stroke={hexToRgba(linkColor, l.opacity)}
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {positionedNodes.map((n, i) => {
        const size = n.r * 1.8;
        return (
          <div
            key={`node-${i}`}
            style={{
              position: "absolute",
              left: `${n.x}%`,
              top: `${n.y}%`,
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: "999px",
              background: hexToRgba(n.color, baseOpacity),
              boxShadow: `0 0 ${size * 1.8}px ${hexToRgba(n.color, baseOpacity * 0.45)}`,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </div>
  );
};
