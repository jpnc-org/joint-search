import { useCurrentFrame } from "remotion";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { NodeGraphBackground } from "performative-ui";

export default function ProblemScene() {
  const frame = useCurrentFrame();
  const showLeft = frame > 20;
  const showRight = frame > 100;

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={40}
        baseOpacity={0.3}
        hoverDistance={0}
      />

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-2 items-center justify-center gap-8 px-8">
        {showLeft && (
          <Card className="border-destructive/50 bg-destructive/5 p-8">
            <CardHeader className="mb-6">
              <CardTitle className="flex items-center gap-3 text-2xl text-destructive">
                <XCircle className="size-8" />
                Quick answer
              </CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-background/50 p-4">
                <XCircle className="size-5 text-destructive" />
                <span className="text-sm">No citations provided</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-background/50 p-4">
                <XCircle className="size-5 text-destructive" />
                <span className="text-sm">Outdated information</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-background/50 p-4">
                <XCircle className="size-5 text-destructive" />
                <span className="text-sm">No contradiction checking</span>
              </div>
            </div>
          </Card>
        )}

        {showRight && (
          <Card className="border-primary/50 bg-primary/5 p-8">
            <CardHeader className="mb-6">
              <CardTitle className="flex items-center gap-3 text-2xl text-primary">
                <CheckCircle2 className="size-8" />
                Trusted research
              </CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-background/50 p-4">
                <CheckCircle2 className="size-5 text-primary" />
                <span className="text-sm">Inline citations</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-background/50 p-4">
                <CheckCircle2 className="size-5 text-primary" />
                <span className="text-sm">Cross-checked evidence</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-background/50 p-4">
                <AlertCircle className="size-5 text-primary" />
                <span className="text-sm">Contradiction flags</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
