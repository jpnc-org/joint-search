import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Sparkle } from "performative-ui";
import { NodeGraphBackground } from "../components/NodeGraphBackground";

export default function FinalScene() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 28], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 34], [0.86, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spinRotation = interpolate(frame, [0, 76], [0, 360], {
    easing: Easing.bezier(0.68, 0, 0.22, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const starOpacity = interpolate(frame, [76, 104, 132], [1, 0.6, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const starScale = interpolate(frame, [76, 104, 132], [1, 0.85, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const starRotation = interpolate(frame, [76, 104, 132], [0, 15, 0], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalPulse = interpolate(frame, [120, 132, 166], [0, 1, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalRingScale = interpolate(frame, [120, 166], [0.72, 2.15], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalRingOpacity = finalPulse * 0.36;
  const pulseGlowOpacity = 0.04 + finalPulse * 0.1;
  const brandOpacity = interpolate(frame, [120, 140], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brandY = interpolate(frame, [120, 144], [22, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={42}
        speed={0.025}
        baseOpacity={0.12}
        hoverDistance={0}
      />

      <div
        className="relative z-10 flex items-center justify-center"
        style={{ opacity, transform: `scale(${scale})` }}
      >
        <div
          className="absolute size-80 rounded-full bg-primary blur-3xl"
          style={{ opacity: pulseGlowOpacity }}
        />
        <div
          className="absolute size-56 rounded-full border border-primary shadow-[0_0_46px_rgba(236,72,153,0.38)]"
          style={{
            opacity: finalRingOpacity,
            transform: `scale(${finalRingScale})`,
          }}
        />
        <div className="absolute size-60 rounded-full border border-primary/15" />
        <div className="absolute size-40 rounded-full border border-primary/10" />
        <Sparkle
          static
          className="relative text-[212px] leading-none"
          style={{
            opacity: starOpacity,
            transform: `scale(${starScale}) rotate(${spinRotation + starRotation}deg)`,
          }}
        />
      </div>

      <div
        className="absolute bottom-28 left-0 right-0 z-10 text-center"
        style={{
          opacity: brandOpacity,
          transform: `translateY(${brandY}px)`,
        }}
      >
        <div className="text-5xl font-semibold tracking-normal">
          JointSearch
        </div>
      </div>
    </div>
  );
}
