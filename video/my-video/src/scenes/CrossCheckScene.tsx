import { useCurrentFrame } from "remotion";
import { ArrowRight, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { NodeGraphBackground } from "performative-ui";

export default function CrossCheckScene() {
  const frame = useCurrentFrame();
  const showResearchers = frame > 10;
  const showArrow = frame > 80;
  const showMedior = frame > 120;
  const showChecks = frame > 200;

  const checks = [
    { label: "Source conflicts", status: "resolved" },
    { label: "Missing citations", status: "resolved" },
    { label: "Weak claims", status: "challenged" },
    { label: "Evidence gaps", status: "flagged" },
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
          <div className="flex gap-4">
            {[1, 2, 3].map((id) => (
              <Card key={id} className="w-48 p-4">
                <CardHeader>
                  <CardTitle className="text-center text-base">
                    Researcher {id}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {showArrow && <ArrowRight className="size-10 text-primary" />}

        {showMedior && (
          <Card className="w-96 border-primary bg-primary/10 p-6">
            <CardHeader>
              <div className="mb-3 flex items-center gap-3">
                <Shield className="size-8 text-primary" />
                <CardTitle className="text-xl">Medior Agent</CardTitle>
              </div>
              <CardDescription>
                Coordinates cross-checking and debate
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {showChecks && (
          <div className="grid grid-cols-2 gap-3">
            {checks.map((check, index) => (
              <Card key={index} className="flex items-center gap-3 p-4">
                {check.status === "resolved" ? (
                  <CheckCircle2 className="size-5 text-primary" />
                ) : (
                  <AlertTriangle className="size-5 text-warning" />
                )}
                <span className="text-sm font-medium">{check.label}</span>
                <Badge
                  variant={check.status === "resolved" ? "default" : "secondary"}
                  className="ml-auto"
                >
                  {check.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
