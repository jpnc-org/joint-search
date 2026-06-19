import { useCurrentFrame } from "remotion";
import { ArrowRight, Bot } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { NodeGraphBackground } from "performative-ui";

export default function OrchestratorScene() {
  const frame = useCurrentFrame();
  const showFrontend = frame > 10;
  const showArrow = frame > 60;
  const showOrchestrator = frame > 100;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.35}
        hoverDistance={0}
      />

      <div className="relative z-10 flex items-center gap-8">
        {showFrontend && (
          <Card className="w-64 p-6">
            <CardHeader>
              <CardTitle className="text-lg">Frontend</CardTitle>
              <CardDescription>User question + documents</CardDescription>
            </CardHeader>
          </Card>
        )}

        {showArrow && (
          <ArrowRight className="size-12 text-primary" />
        )}

        {showOrchestrator && (
          <Card className="w-80 border-primary bg-primary/10 p-6">
            <CardHeader>
              <div className="mb-3 flex items-center gap-3">
                <Bot className="size-8 text-primary" />
                <CardTitle className="text-xl">Research Orchestrator</CardTitle>
              </div>
              <CardDescription>
                Receives request, tracks task, delegates to Planner
              </CardDescription>
            </CardHeader>
            <div className="mt-4 space-y-2">
              <Badge variant="outline" className="w-full justify-start">
                Task tracking
              </Badge>
              <Badge variant="outline" className="w-full justify-start">
                Delegation
              </Badge>
              <Badge variant="outline" className="w-full justify-start">
                Quality review
              </Badge>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
