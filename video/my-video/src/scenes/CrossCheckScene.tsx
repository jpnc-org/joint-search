import type { ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CheckCircle2, MessageSquare, Search, ShieldCheck } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
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

type ChatMessageProps = {
  author: string;
  children: ReactNode;
  delay: number;
  medior?: boolean;
};

const Mention = ({ children }: { children: ReactNode }) => (
  <span className="font-semibold text-primary">{children}</span>
);

const ChatMessage = ({ author, children, delay, medior = false }: ChatMessageProps) => {
  const frame = useCurrentFrame();
  const opacity = appear(frame, delay);
  const y = slide(frame, delay);

  return (
    <div
      className="flex gap-3"
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          medior ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"
        }`}
      >
        {medior ? (
          <ShieldCheck className="size-4" />
        ) : (
          <Search className="size-4" />
        )}
      </div>
      <div
        className={`rounded-2xl border p-4 ${
          medior
            ? "border-primary/40 bg-primary/10 shadow-[0_0_34px_rgba(105,92,255,0.14)]"
            : "border-border/60 bg-card/85"
        }`}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold">{author}</span>
          {medior && <Badge variant="outline">supervision</Badge>}
        </div>
        <div className="max-w-[640px] text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function CrossCheckScene() {
  const frame = useCurrentFrame();
  const titleOpacity = appear(frame, 10);
  const titleY = slide(frame, 10);
  const panelOpacity = appear(frame, 35);
  const panelY = slide(frame, 35);

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.32}
        hoverDistance={0}
      />

      <div className="relative z-10 flex w-full max-w-6xl flex-col px-10">
        <div
          className="mb-8 text-center"
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <Badge variant="outline" className="mb-4 px-4 py-2">
            Band.ai research room
          </Badge>
          <h2 className="text-4xl font-semibold tracking-tight">
            Researchers cross-check findings in Band.ai under Medior supervision
          </h2>
        </div>

        <div
          className="grid grid-cols-[300px_1fr] gap-6"
          style={{
            opacity: panelOpacity,
            transform: `translateY(${panelY}px)`,
          }}
        >
          <Card className="border-primary/25 bg-card/90 p-6 shadow-[0_0_38px_rgba(105,92,255,0.12)] backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3">
              <MessageSquare className="size-6 text-primary" />
              <div>
                <div className="font-semibold">Band.ai research room</div>
                <div className="text-sm text-muted-foreground">
                  Multi-agent collaboration
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {[
                ["Researcher 1", "Market + category signals"],
                ["Researcher 2", "Workflow + user pain"],
                ["Researcher 3", "Competitors + source quality"],
                ["Medior", "Cross-check supervisor"],
              ].map(([name, role], index) => (
                <div
                  key={name}
                  className="rounded-xl border border-border/60 bg-background/45 p-3"
                  style={{ opacity: appear(frame, 55 + index * 24) }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{name}</span>
                    {index < 3 ? (
                      <Search className="size-4 text-primary" />
                    ) : (
                      <ShieldCheck className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{role}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="relative overflow-hidden border-primary/25 bg-card/90 p-6 shadow-[0_0_38px_rgba(105,92,255,0.12)] backdrop-blur-xl">
            <div className="absolute -inset-10 bg-primary/10 blur-3xl" />
            <div className="relative space-y-4">
              <ChatMessage author="Researcher 1" delay={80}>
                <Mention>@Researcher 2</Mention> market sources agree demand is
                moving toward managed research workflows, not generic chatbots.
                Confidence: medium-high.
              </ChatMessage>

              <ChatMessage author="Researcher 2" delay={120}>
                <Mention>@Researcher 1</Mention> confirmed. User-flow notes show
                teams ask for citations before sharing answers with stakeholders.
              </ChatMessage>

              <ChatMessage author="Researcher 3" delay={160}>
                <Mention>@Researcher 1</Mention> <Mention>@Researcher 2</Mention>{" "}
                competitor claims are weaker on source traceability; two docs lack
                direct source links.
              </ChatMessage>

              <ChatMessage author="Researcher 1" delay={200}>
                <Mention>@Researcher 3</Mention> good catch. I am downgrading
                that competitor point to an uncertainty and attaching the two
                missing-source docs for Medior review.
              </ChatMessage>

              <ChatMessage author="Researcher 2" delay={240}>
                <Mention>@Medior</Mention> all assigned findings now include source
                notes, confidence levels, and open limitations.
              </ChatMessage>

              <ChatMessage author="Medior" delay={285} medior>
                Cross-check complete. Findings are aligned, weak claims are marked,
                and unresolved uncertainty is ready for synthesis.
              </ChatMessage>

              <div
                className="flex items-center justify-end gap-2 pt-1 text-sm text-primary"
                style={{ opacity: appear(frame, 320) }}
              >
                <CheckCircle2 className="size-4" />
                Ready for final synthesis
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
