import { useCurrentFrame } from "remotion";
import { FileText, AlertTriangle } from "lucide-react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { NodeGraphBackground } from "performative-ui";

export default function ColdOpenScene() {
  const frame = useCurrentFrame();
  const showPdf = frame > 20;
  const showNotes = frame > 60;
  const showContradiction = frame > 100;
  const showSearch = frame > 150;

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.35}
        hoverDistance={0}
      />

      <div className="relative z-10 flex flex-col items-center justify-center gap-8">
        {showPdf && (
          <Card className="flex items-center gap-4 p-6">
            <FileText className="size-12 text-primary" />
            <div>
              <div className="text-lg font-semibold">research-paper.pdf</div>
              <div className="text-sm text-muted-foreground">2.4MB · 47 pages</div>
            </div>
          </Card>
        )}

        {showNotes && (
          <Card className="flex items-center gap-4 p-6">
            <FileText className="size-12 text-primary" />
            <div>
              <div className="text-lg font-semibold">meeting-notes.md</div>
              <div className="text-sm text-muted-foreground">12KB · 23 bullet points</div>
            </div>
          </Card>
        )}

        {showContradiction && (
          <Card className="flex items-center gap-4 border-destructive bg-destructive/10 p-6">
            <AlertTriangle className="size-12 text-destructive" />
            <div>
              <div className="text-lg font-semibold text-destructive">Contradiction detected</div>
              <div className="text-sm text-muted-foreground">
                Source A claims 47% growth · Source B claims 23% decline
              </div>
            </div>
          </Card>
        )}

        {showSearch && (
          <div className="w-96">
            <Input
              placeholder="Ask a complex question..."
              className="h-14 text-lg"
              readOnly
            />
          </div>
        )}
      </div>
    </div>
  );
}
