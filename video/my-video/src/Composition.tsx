import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import ColdOpenScene from "./scenes/ColdOpenScene";
import ProblemScene from "./scenes/ProblemScene";
import LandingScene from "./scenes/LandingScene";
import LoginScene from "./scenes/LoginScene";
import OrchestratorScene from "./scenes/OrchestratorScene";
import PlannerScene from "./scenes/PlannerScene";
import ResearchersScene from "./scenes/ResearchersScene";
import CrossCheckScene from "./scenes/CrossCheckScene";
import SynthesisScene from "./scenes/SynthesisScene";
import ChatScene from "./scenes/ChatScene";

const COLD_OPEN_DURATION = 210;
const PROBLEM_START = 210;
const PROBLEM_DURATION = 240;
const LANDING_START = 450;
const LANDING_DURATION = 270;
const LOGIN_START = 720;
const LOGIN_DURATION = 150;
const POST_LOGIN_CHAT_START = 870;
const POST_LOGIN_CHAT_DURATION = 480;
const ORCHESTRATOR_START = 1350;
const ORCHESTRATOR_DURATION = 300;
const PLANNER_START = 1650;
const PLANNER_DURATION = 360;
const RESEARCHERS_START = 2010;
const RESEARCHERS_DURATION = 360;
const CROSSCHECK_START = 2370;
const CROSSCHECK_DURATION = 360;
const SYNTHESIS_START = 2730;
const SYNTHESIS_DURATION = 330;
const CHAT_START = 3060;
const CHAT_DURATION = 210;
const SCENE_TRANSITION_DURATION = 24;

type SceneSequenceProps = {
  children: ReactNode;
  durationInFrames: number;
  from?: number;
  isFirst?: boolean;
  zIndex: number;
};

const SceneTransition = ({
  children,
  isFirst = false,
}: {
  children: ReactNode;
  isFirst?: boolean;
}) => {
  const frame = useCurrentFrame();
  const opacity = isFirst
    ? 1
    : interpolate(frame, [0, SCENE_TRANSITION_DURATION], [0, 1], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const y = isFirst
    ? 0
    : interpolate(frame, [0, SCENE_TRANSITION_DURATION], [18, 0], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const scale = isFirst
    ? 1
    : interpolate(frame, [0, SCENE_TRANSITION_DURATION], [0.985, 1], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const SceneSequence = ({
  children,
  durationInFrames,
  from,
  isFirst = false,
  zIndex,
}: SceneSequenceProps) => (
  <Sequence
    from={from}
    durationInFrames={durationInFrames + SCENE_TRANSITION_DURATION}
    style={{ zIndex }}
  >
    <SceneTransition isFirst={isFirst}>{children}</SceneTransition>
  </Sequence>
);

export const MyComposition = () => {
  return (
    <AbsoluteFill className="bg-background text-foreground">
      <SceneSequence
        durationInFrames={COLD_OPEN_DURATION}
        isFirst
        zIndex={1}
      >
        <ColdOpenScene />
      </SceneSequence>
      <SceneSequence
        from={PROBLEM_START}
        durationInFrames={PROBLEM_DURATION}
        zIndex={2}
      >
        <ProblemScene />
      </SceneSequence>
      <SceneSequence
        from={LANDING_START}
        durationInFrames={LANDING_DURATION}
        zIndex={3}
      >
        <LandingScene />
      </SceneSequence>
      <SceneSequence
        from={LOGIN_START}
        durationInFrames={LOGIN_DURATION}
        zIndex={4}
      >
        <LoginScene />
      </SceneSequence>
      <SceneSequence
        from={POST_LOGIN_CHAT_START}
        durationInFrames={POST_LOGIN_CHAT_DURATION}
        zIndex={5}
      >
        <ChatScene animateQueryInput />
      </SceneSequence>
      <SceneSequence
        from={ORCHESTRATOR_START}
        durationInFrames={ORCHESTRATOR_DURATION}
        zIndex={6}
      >
        <OrchestratorScene />
      </SceneSequence>
      <SceneSequence
        from={PLANNER_START}
        durationInFrames={PLANNER_DURATION}
        zIndex={7}
      >
        <PlannerScene />
      </SceneSequence>
      <SceneSequence
        from={RESEARCHERS_START}
        durationInFrames={RESEARCHERS_DURATION}
        zIndex={8}
      >
        <ResearchersScene />
      </SceneSequence>
      <SceneSequence
        from={CROSSCHECK_START}
        durationInFrames={CROSSCHECK_DURATION}
        zIndex={9}
      >
        <CrossCheckScene />
      </SceneSequence>
      <SceneSequence
        from={SYNTHESIS_START}
        durationInFrames={SYNTHESIS_DURATION}
        zIndex={10}
      >
        <SynthesisScene />
      </SceneSequence>
      <SceneSequence
        from={CHAT_START}
        durationInFrames={CHAT_DURATION}
        zIndex={11}
      >
        <ChatScene />
      </SceneSequence>
    </AbsoluteFill>
  );
};

export const compositionDuration =
  COLD_OPEN_DURATION +
  PROBLEM_DURATION +
  LANDING_DURATION +
  LOGIN_DURATION +
  POST_LOGIN_CHAT_DURATION +
  ORCHESTRATOR_DURATION +
  PLANNER_DURATION +
  RESEARCHERS_DURATION +
  CROSSCHECK_DURATION +
  SYNTHESIS_DURATION +
  CHAT_DURATION;
