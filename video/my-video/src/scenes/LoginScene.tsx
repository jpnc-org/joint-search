import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Spinner } from "../components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { NodeGraphBackground } from "../components/NodeGraphBackground";
import { Sparkle } from "performative-ui";

const typeText = (text: string, frame: number, start: number, speed = 2.4) => {
  const length = Math.max(0, Math.floor((frame - start) / speed));
  return text.slice(0, length);
};

export default function LoginScene() {
  const frame = useCurrentFrame();
  const backgroundOpacity = interpolate(frame, [0, 12], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOpacity = interpolate(frame, [12, 36], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [12, 36], [28, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardScale = interpolate(frame, [12, 36], [0.97, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const email = typeText("team@deepresearch.dev", frame, 42, 1.9);
  const password = typeText("************", frame, 82, 1.5);
  const loading = frame > 118;

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: backgroundOpacity }}
      >
        <div className="absolute inset-0 bg-background" />
        <NodeGraphBackground
          className="absolute inset-0 h-full w-full"
          density={40}
          baseOpacity={0.3}
          hoverDistance={0}
        />
      </div>
      <div
        className="relative z-10 flex w-full items-center justify-center"
        style={{
          opacity: cardOpacity,
          transform: `translateY(${cardY}px) scale(${cardScale})`,
        }}
      >
        <Card className="w-[440px] border-border/60 bg-card/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mb-2 flex items-center justify-center gap-1.5">
              <Sparkle />{" "}
              <CardTitle className="text-xl">DeepResearch</CardTitle>
            </div>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  readOnly
                  className={
                    frame >= 42 && frame < 82
                      ? "border-primary ring-2 ring-ring"
                      : ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  readOnly
                  className={
                    frame >= 82 && frame < 118
                      ? "border-primary ring-2 ring-ring"
                      : ""
                  }
                />
              </div>
              <Button
                type="button"
                disabled={loading}
                className="w-full"
              >
                {loading && <Spinner className="mr-1" />}
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No account?{" "}
              <span className="text-primary hover:underline">
                Create one
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
