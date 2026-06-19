import type { ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import {
  ArrowDownLeft,
  ArrowRight,
  Bot,
  Brain,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { NodeGraphBackground } from "performative-ui";

const appear = (frame: number, start: number) =>
  interpolate(frame, [start, start + 18], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const slide = (frame: number, start: number) =>
  interpolate(frame, [start, start + 18], [18, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

type NodeCardProps = {
  delay: number;
  description: string;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
};

const NodeCard = ({
  children,
  delay,
  description,
  icon,
  title,
}: NodeCardProps) => {
  const frame = useCurrentFrame();
  const opacity = appear(frame, delay);
  const y = slide(frame, delay);

  return (
    <div
      className="relative"
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      <div className="absolute -inset-6 rounded-[30px] bg-primary/12 blur-3xl" />
      <Card className="relative w-[290px] border-primary/25 bg-card/90 p-6 shadow-[0_0_38px_rgba(105,92,255,0.12)] backdrop-blur-xl">
        <CardHeader className="p-0">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-[0_0_16px_rgba(105,92,255,0.18)]">
              {icon}
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
          </div>
          <CardDescription className="text-base leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        {children && <CardContent className="mt-5 p-0">{children}</CardContent>}
      </Card>
    </div>
  );
};

const FlowArrow = ({ delay, reverse = false }: { delay: number; reverse?: boolean }) => {
  const frame = useCurrentFrame();
  const opacity = appear(frame, delay);

  return (
    <ArrowRight
      className="size-10 shrink-0 text-primary"
      style={{
        opacity,
        transform: reverse ? "rotate(180deg)" : undefined,
      }}
    />
  );
};

export default function ArchitectureScene() {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [430, 520], [1, 2.15], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(frame, [430, 520], [0, -520], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [430, 520], [0, -20], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showMediorArrow = frame > 245;

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={52}
        speed={0.001}
        baseOpacity={0.32}
        hoverDistance={0}
      />

      <div
        className="relative z-10 flex w-full max-w-[1660px] items-center justify-center px-10"
        style={{
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
          transformOrigin: "64% 50%",
        }}
      >
        <div className="flex items-center gap-8">
          <NodeCard
            delay={15}
            icon={<MessageSquareText className="size-5" />}
            title="Query"
            description="User asks for a grounded research answer."
          />

          <FlowArrow delay={55} />

          <NodeCard
            delay={75}
            icon={<Bot className="size-5" />}
            title="Research Orchestrator"
            description="Controls quality, asks for one revision if needed."
          >
            <Badge variant="outline">Quality gate</Badge>
          </NodeCard>

          <FlowArrow delay={125} />

          <NodeCard
            delay={145}
            icon={<Brain className="size-5" />}
            title="Research Planner"
            description="Breaks the task into subtopics and synthesizes a draft."
          >
            <Badge variant="outline">Task decomposition</Badge>
          </NodeCard>

          <FlowArrow delay={195} />

          <div className="relative">
            <NodeCard
              delay={215}
              icon={<Search className="size-5" />}
              title="Researchers"
              description="Run focused searches, compare sources, report limits."
            >
              <div className="grid grid-cols-3 gap-2">
                {["R1", "R2", "R3"].map((label) => (
                  <Badge key={label} variant="secondary" className="justify-center">
                    {label}
                  </Badge>
                ))}
              </div>
            </NodeCard>

            <div
              className="absolute -bottom-40 left-1/2 flex -translate-x-1/2 items-center gap-4"
              style={{ opacity: appear(frame, 255) }}
            >
              <div className="absolute -inset-6 rounded-[28px] bg-primary/12 blur-3xl" />
              <Card className="relative w-[280px] border-primary/30 bg-primary/10 p-5 shadow-[0_0_34px_rgba(105,92,255,0.14)] backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <Sparkles className="size-7 text-primary" />
                  <div>
                    <div className="text-lg font-semibold">Medior</div>
                    <div className="text-sm text-muted-foreground">
                      External evidence check
                    </div>
                  </div>
                </div>
              </Card>
              {showMediorArrow && (
                <ArrowDownLeft className="absolute -top-11 left-1/2 size-10 -translate-x-1/2 rotate-[135deg] text-primary" />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
