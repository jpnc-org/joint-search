import { useCurrentFrame } from "remotion";
import { ArrowRight, Scissors, Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { NodeGraphBackground } from "performative-ui";

export default function PlannerScene() {
  const frame = useCurrentFrame();
  const showOrchestrator = frame > 10;
  const showArrow = frame > 60;
  const showPlanner = frame > 100;
  const showSubtopics = frame > 180;

  const subtopics = [
    { title: "Market analysis", researcher: "Researcher 1" },
    { title: "Workflow design", researcher: "Researcher 2" },
    { title: "Evidence review", researcher: "Researcher 3" },
  ];

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.35}
        hoverDistance={0}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="flex items-center gap-8">
          {showOrchestrator && (
            <Card className="w-64 p-6">
              <CardHeader>
                <CardTitle className="text-lg">Orchestrator</CardTitle>
              </CardHeader>
            </Card>
          )}

          {showArrow && <ArrowRight className="size-10 text-primary" />}

          {showPlanner && (
            <Card className="w-80 border-primary bg-primary/10 p-6">
              <CardHeader>
                <div className="mb-3 flex items-center gap-3">
                  <Scissors className="size-8 text-primary" />
                  <CardTitle className="text-xl">Research Planner</CardTitle>
                </div>
                <CardDescription>
                  Decomposes task into focused subtopics
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {showSubtopics && (
          <div className="grid grid-cols-3 gap-4">
            {subtopics.map((topic, index) => (
              <Card key={index} className="w-56 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  <span className="text-sm font-semibold">{topic.title}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {topic.researcher}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
