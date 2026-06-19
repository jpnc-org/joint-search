import type { ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardTitle } from "../components/ui/card";
import { NodeGraphBackground } from "performative-ui";

const appear = (frame: number, start: number) =>
  interpolate(frame, [start, start + 18], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const slide = (frame: number, start: number) =>
  interpolate(frame, [start, start + 18], [22, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

type GlowCardProps = {
  children: ReactNode;
  delay: number;
  className?: string;
};

const GlowCard = ({ children, className = "", delay }: GlowCardProps) => {
  const frame = useCurrentFrame();
  const opacity = appear(frame, delay);
  const y = slide(frame, delay);

  return (
    <div
      className="relative"
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      <div className="absolute -inset-6 rounded-[30px] bg-primary/12 blur-3xl" />
      <Card
        className={`relative border-primary/25 bg-card/90 shadow-[0_0_38px_rgba(105,92,255,0.12)] backdrop-blur-xl ${className}`}
      >
        {children}
      </Card>
    </div>
  );
};

export default function IntroScene() {
  const frame = useCurrentFrame();
  const titleOpacity = appear(frame, 20);
  const titleY = slide(frame, 20);
  const facts = [
    {
      delay: 85,
      title: "LLM might hallucinate facts",
      detail: "A fluent answer can still invent unsupported claims.",
    },
    {
      delay: 130,
      title: "No citations or source links",
      detail: "There is nothing concrete to inspect or follow up.",
    },
    {
      delay: 175,
      title: "Information may be outdated",
      detail: "Fast answers can miss newer evidence and context.",
    },
    {
      delay: 220,
      title: "No way to verify claims",
      detail: "The user has to trust the answer instead of checking it.",
    },
  ];

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={52}
        baseOpacity={0.32}
        hoverDistance={0}
      />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center px-10">
        <div
          className="mb-12 text-center"
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <Badge variant="outline" className="mb-5 px-4 py-2 text-sm">
            What breaks trust
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight">
            Quick LLM answers can look confident and still be wrong
          </h1>
        </div>

        <div className="grid w-full grid-cols-2 gap-7">
          {facts.map((fact, index) => (
            <GlowCard
              key={fact.title}
              delay={fact.delay}
              className="min-h-[190px] border-destructive/25 p-7"
            >
              <CardTitle className="mb-5 flex items-start gap-4 text-2xl text-destructive">
                {index === 0 ? (
                  <AlertTriangle className="mt-0.5 size-8 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 size-8 shrink-0" />
                )}
                {fact.title}
              </CardTitle>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {fact.detail}
              </p>
            </GlowCard>
          ))}
        </div>
      </div>
    </div>
  );
}
