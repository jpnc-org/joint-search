import { useCurrentFrame } from "remotion";
import {
  Plus,
  Send,
  Trash2,
  Settings,
  FolderOpen,
  Search,
  ChevronRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import { ChatBubble } from "performative-ui";

const CAP_LABELS: Record<string, string> = {
  code_interpreter: "Code",
  rlm: "RLM",
  rag: "RAG",
  web_search: "Web",
};

const QUERY_TEXT =
  "Research the best positioning for our multi-agent deep research platform. Use the uploaded pitch notes and market documents.";

const REPORT_TEXT =
  "Here is the verified synthesis: the opportunity is strongest when the product is positioned as a managed research workflow, not just a chatbot. Evidence coverage is strong across uploaded docs and recent web findings. Main risk: source quality varies, so disputed claims are marked for review.";

const typeText = (text: string, frame: number, start: number, speed = 2.4) => {
  const length = Math.max(0, Math.floor((frame - start) / speed));
  return text.slice(0, length);
};

type ChatSceneProps = {
  animateQueryInput?: boolean;
};

export default function ChatScene({
  animateQueryInput = false,
}: ChatSceneProps) {
  const frame = useCurrentFrame();
  const querySubmitFrame = animateQueryInput ? 155 : 0;
  const aiStartFrame = animateQueryInput ? 185 : 0;
  const reportStartFrame = animateQueryInput ? 220 : 92;
  const reportSpeed = animateQueryInput ? 0.65 : 1.15;
  const typedQuery = animateQueryInput
    ? typeText(QUERY_TEXT, frame, 18, 0.85)
    : "";
  const reportText = typeText(
    REPORT_TEXT,
    frame,
    reportStartFrame,
    reportSpeed,
  );
  const streaming = frame < reportStartFrame;
  const showUserMessage = !animateQueryInput || frame >= querySubmitFrame;
  const showAiMessage = !animateQueryInput || frame >= aiStartFrame;
  const inputValue =
    animateQueryInput && frame < querySubmitFrame ? typedQuery : "";
  const sendHighlighted =
    animateQueryInput && frame >= 128 && frame < querySubmitFrame;

  const capabilities = {
    code_interpreter: false,
    rlm: false,
    rag: true,
    web_search: true,
  };

  const conversations = [
    "Hackathon submission research",
    "Agent architecture review",
    "Market opportunity scan",
    "Uploaded docs fact-check",
  ];

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-3 space-y-2">
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            size="sm"
          >
            <Search className="size-3.5" /> Search
          </Button>
          <Button className="w-full cursor-pointer" size="sm">
            <Plus className="size-4" /> New Chat
          </Button>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map((title, index) => (
            <div key={title} className="group flex items-center gap-1">
              <button
                className={cn(
                  "flex-1 truncate rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                  index === 0
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
                )}
              >
                {title}
              </button>
              <button className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 cursor-pointer">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Separator />
        <div className="p-3 space-y-2">
          <div className="truncate text-sm font-medium">Hackathon Team</div>
          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="w-full cursor-pointer"
            >
              <FolderOpen className="size-3.5" /> Knowledge Base
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full cursor-pointer"
            >
              <Settings className="size-3.5" /> Settings
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          {(Object.keys(CAP_LABELS) as string[]).map((cap) => {
            const on = capabilities[cap as keyof typeof capabilities];
            return (
              <button
                key={cap}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:bg-accent",
                )}
              >
                {CAP_LABELS[cap]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {showUserMessage && (
              <ChatBubble role="user">{QUERY_TEXT}</ChatBubble>
            )}
            {showAiMessage && (
              <ChatBubble
                role="ai"
                agent="DeepResearch"
                thinking={streaming && !reportText ? "thinking..." : false}
              >
                {reportText && (
                  <details className="mb-2 text-xs text-muted-foreground">
                    <summary className="flex cursor-pointer items-center gap-1 select-none hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                      Reasoning
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap pl-4">
                      Planner split the task into market, workflow, evidence,
                      and risk analysis. Researchers cross-checked source gaps
                      with Medior.
                    </p>
                  </details>
                )}
                {reportText}
              </ChatBubble>
            )}
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative rounded-xl border bg-card p-2">
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Message... (type @ to mention KBs, tags, files)"
                  value={inputValue}
                  className={cn(
                    "max-h-[150px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0",
                    inputValue ? "min-h-[52px]" : "min-h-[24px]",
                  )}
                  rows={inputValue ? 2 : 1}
                  readOnly
                />
                <Button
                  size="icon"
                  className={cn(
                    "shrink-0 cursor-pointer",
                    sendHighlighted && "ring-2 ring-ring",
                  )}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
