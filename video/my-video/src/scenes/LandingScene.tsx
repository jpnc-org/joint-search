import { FileText, Layers } from "lucide-react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Button } from "../components/ui/button";
import { NodeGraphBackground } from "../components/NodeGraphBackground";
import {
  GlassCard,
  Sparkle,
  EyebrowPill,
  BeforeAfter,
  SlippyWords,
  WordRoll,
} from "performative-ui";

export default function LandingScene() {
  const frame = useCurrentFrame();
  const scrollY = interpolate(
    frame,
    [15, 260],
    [0, 900],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.35}
        hoverDistance={0}
      />

      <nav className="absolute top-0 z-20 flex w-full items-center justify-between border-b border-border/40 bg-background/80 px-6 py-5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkle /> JointSearch
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="cursor-pointer">
              Sign in
            </Button>
            <Button size="sm" className="cursor-pointer">
              Get started
            </Button>
          </div>
        </div>
      </nav>

      <div
        className="relative z-10 flex min-h-screen flex-col pt-[78px]"
        style={{ transform: `translateY(-${scrollY}px)` }}
      >
        <section className="flex w-full flex-1 flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
          <h1 className="flex flex-wrap items-baseline justify-center gap-x-3 pb-4 leading-[1.5] text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            <span>Stop guessing.</span>
            <span>Start</span>
            <WordRoll
              words={["verifying.", "fact-checking.", "tracing sources."]}
              gradient
              intervalMs={2800}
            />
          </h1>

          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Upload your knowledge base, enable web search or code execution, and
            get grounded answers with traceable sources.
          </p>
        </section>

        <section className="w-full py-16">
          <SlippyWords
            className="w-full"
            intensity={100}
            fade
            static
            rows={[
              [
                "Fact-Checking",
                "Web Search",
                "Document Analysis",
                "RAG",
                "Deep Research",
                "Citations",
                "Source Tracing",
                "Grounded Answers",
                "Code Interpreter",
              ],
              [
                "File Mentions",
                "Knowledge Base",
                "No Hallucinations",
                "Per-conversation Toggles",
                "Multi-hop Reasoning",
                "Inline Sources",
                "Tag Filtering",
                "Nested Folders",
                "SSE Streaming",
              ],
            ]}
          />
        </section>

        <section className="w-full px-6 py-32">
          <div className="mb-10 text-center">
            <EyebrowPill icon={false} className="mb-4">
              The difference
            </EyebrowPill>
            <h2 className="text-3xl font-bold tracking-tight">
              Every claim, backed by evidence
            </h2>
          </div>

          <div className="mx-auto w-full max-w-5xl">
            <BeforeAfter
              beforeLabel="Without JointSearch"
              afterLabel="With JointSearch"
              brand="JointSearch"
              before={[
                "LLM might hallucinate facts",
                "No citations or source links",
                "Information may be outdated",
                "No way to verify claims",
              ]}
              after={[
                "Every claim cross-checked against your documents",
                "Inline citations you can click through",
                "Live web search fills knowledge gaps",
                "Fact-check verdicts on every statement",
              ]}
            />
          </div>
        </section>

        <section className="w-full px-6 py-32">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                <Layers className="size-7 text-primary" /> Knowledge Base
              </h2>
              <p className="mt-3 text-muted-foreground">
                Create nested folders. Tag files for cross-referencing. Group
                documents into knowledge bases. Mention any file or tag by name
                in chat to pull context instantly.
              </p>
            </div>
            <GlassCard className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-4">
                  <FileText className="size-8 text-primary" />
                  <span className="text-sm">research-paper.pdf</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    2.4MB
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-4">
                  <FileText className="size-8 text-primary" />
                  <span className="text-sm">dataset.csv</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    890KB
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-4">
                  <FileText className="size-8 text-primary" />
                  <span className="text-sm">notes.md</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    12KB
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        <footer className="w-full border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Sparkle solid /> JointSearch
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
