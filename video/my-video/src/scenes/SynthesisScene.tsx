import { useCurrentFrame } from "remotion";
import { ArrowRight, FileCheck, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { NodeGraphBackground } from "performative-ui";

export default function SynthesisScene() {
  const frame = useCurrentFrame();
  const showMedior = frame > 10;
  const showArrow1 = frame > 60;
  const showPlanner = frame > 100;
  const showArrow2 = frame > 160;
  const showOrchestrator = frame > 200;
  const showChecklist = frame > 260;

  const checklist = [
    "Completeness",
    "Factual support",
    "Source coverage",
    "Uncertainty marked",
    "Directness",
  ];

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.35}
        hoverDistance={0}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="flex items-center gap-6">
          {showMedior && (
            <Card className="w-56 p-4">
              <CardHeader>
                <CardTitle className="text-center text-base">Medior</CardTitle>
              </CardHeader>
            </Card>
          )}

          {showArrow1 && <ArrowRight className="size-8 text-primary" />}

          {showPlanner && (
            <Card className="w-56 p-4">
              <CardHeader>
                <CardTitle className="text-center text-base">Planner</CardTitle>
              </CardHeader>
            </Card>
          )}

          {showArrow2 && <ArrowRight className="size-8 text-primary" />}

          {showOrchestrator && (
            <Card className="w-64 border-primary bg-primary/10 p-4">
              <CardHeader>
                <CardTitle className="text-center text-base">
                  Orchestrator
                </CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>

        {showChecklist && (
          <Card className="w-[500px] p-6">
            <CardHeader className="mb-4">
              <div className="flex items-center gap-3">
                <FileCheck className="size-6 text-primary" />
                <CardTitle className="text-lg">Quality Review</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-3">
              {checklist.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg bg-background/50 p-3"
                >
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="text-sm font-medium">{item}</span>
                  <Badge className="ml-auto">Pass</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
