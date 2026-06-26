import type { ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileCheck,
  MonitorUp,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { NodeGraphBackground } from "../components/NodeGraphBackground";

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

type HandoffCardProps = {
  children?: ReactNode;
  delay: number;
  description: string;
  icon: ReactNode;
  title: string;
};

const HandoffCard = ({
  children,
  delay,
  description,
  icon,
  title,
}: HandoffCardProps) => {
  const frame = useCurrentFrame();
  const opacity = appear(frame, delay);
  const y = slide(frame, delay);

  return (
    <div
      className="relative"
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      <div className="absolute -inset-5 rounded-[30px] bg-primary/6 blur-3xl" />
      <Card className="relative w-[320px] border-primary/20 bg-card/90 p-6 shadow-[0_0_22px_rgba(105,92,255,0.06)] backdrop-blur-xl">
        <CardHeader className="p-0">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
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

const FlowArrow = ({ delay }: { delay: number }) => {
  const frame = useCurrentFrame();
  const opacity = appear(frame, delay);

  return (
    <ArrowRight className="size-11 shrink-0 text-primary" style={{ opacity }} />
  );
};

export default function SynthesisScene() {
  const frame = useCurrentFrame();
  const titleOpacity = appear(frame, 10);
  const titleY = slide(frame, 10);
  const packageOpacity = appear(frame, 205);
  const packageY = slide(frame, 205);
  const sendOpacity = appear(frame, 275);

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        speed={0.035}
        baseOpacity={0.18}
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
          <Badge variant="outline" className="mb-4 px-4 py-2">
            Final handoff
          </Badge>
          <h2 className="text-4xl font-semibold tracking-tight">
            Medior transfers the verified answer to the Research Orchestrator
          </h2>
        </div>

        <div className="flex items-center justify-center gap-8">
          <HandoffCard
            delay={50}
            icon={<ShieldCheck className="size-5" />}
            title="Medior"
            description="Packages the cross-checked findings, source notes, and open limitations."
          >
            <Badge variant="outline">Verified package</Badge>
          </HandoffCard>

          <FlowArrow delay={105} />

          <HandoffCard
            delay={125}
            icon={<Bot className="size-5" />}
            title="Research Orchestrator"
            description="Performs the final quality pass and approves the user-facing answer."
          >
            <Badge variant="outline">Quality approved</Badge>
          </HandoffCard>

          <FlowArrow delay={180} />

          <HandoffCard
            delay={200}
            icon={<MonitorUp className="size-5" />}
            title="Frontend"
            description="Receives the completed answer and renders it in the chat."
          >
            <Badge variant="outline">Answer delivered</Badge>
          </HandoffCard>
        </div>

        <Card
          className="mt-10 w-full max-w-4xl border-primary/20 bg-primary/6 p-5 shadow-[0_0_22px_rgba(105,92,255,0.07)] backdrop-blur-xl"
          style={{
            opacity: packageOpacity,
            transform: `translateY(${packageY}px)`,
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            {[
              ["Sources attached", "Citations stay traceable"],
              ["Limitations marked", "Weak claims remain visible"],
              ["Final answer ready", "Frontend can stream result"],
            ].map(([title, detail]) => (
              <div
                key={title}
                className="rounded-xl border border-border/60 bg-background/45 p-4"
              >
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 text-primary" />
                  {title}
                </div>
                <div className="text-sm text-muted-foreground">{detail}</div>
              </div>
            ))}
          </div>
        </Card>

        <div
          className="mt-7 flex items-center gap-3 text-primary"
          style={{ opacity: sendOpacity }}
        >
          <Send className="size-5" />
          <span className="text-sm font-medium">
            Research Orchestrator sends the final answer to the frontend
          </span>
          <FileCheck className="size-5" />
        </div>
      </div>
    </div>
  );
}
