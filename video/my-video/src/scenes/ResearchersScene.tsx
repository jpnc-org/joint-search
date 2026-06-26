import { useCurrentFrame } from "remotion";
import { Search, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { NodeGraphBackground } from "performative-ui";

export default function ResearchersScene() {
  const frame = useCurrentFrame();
  const showResearchers = frame > 20;
  const showEvidence = frame > 150;

  const researchers = [
    { id: 1, angle: "Market trends", docs: 3, facts: 12 },
    { id: 2, angle: "User workflows", docs: 5, facts: 18 },
    { id: 3, angle: "Competitor analysis", docs: 4, facts: 15 },
  ];

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.35}
        hoverDistance={0}
      />

      <div className="relative z-10 flex flex-col items-center justify-center gap-8">
        {showResearchers && (
          <div className="grid grid-cols-3 gap-6">
            {researchers.map((r) => (
              <Card key={r.id} className="w-64 border-primary bg-primary/5 p-6">
                <CardHeader>
                  <div className="mb-3 flex items-center gap-3">
                    <Search className="size-6 text-primary" />
                    <CardTitle className="text-lg">Researcher {r.id}</CardTitle>
                  </div>
                  <CardDescription className="text-sm font-semibold">
                    {r.angle}
                  </CardDescription>
                </CardHeader>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span>{r.docs} documents analyzed</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    <span>{r.facts} facts confirmed</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showEvidence && (
          <Card className="w-[600px] p-6">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="px-4 py-2">
                Parallel investigation
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                Evidence separation
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                Uncertainty flagged
              </Badge>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
