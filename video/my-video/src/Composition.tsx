import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import IntroScene from "./scenes/IntroScene";
import LandingScene from "./scenes/LandingScene";
import LoginScene from "./scenes/LoginScene";
import ArchitectureScene from "./scenes/ArchitectureScene";
import CrossCheckScene from "./scenes/CrossCheckScene";
import SynthesisScene from "./scenes/SynthesisScene";
import ChatScene from "./scenes/ChatScene";

const INTRO_DURATION = 450;
const LANDING_START = 450;
const LANDING_DURATION = 270;
const LOGIN_START = 720;
const LOGIN_DURATION = 150;
const POST_LOGIN_CHAT_START = 870;
const POST_LOGIN_CHAT_DURATION = 480;
const ARCHITECTURE_START = 1350;
const ARCHITECTURE_DURATION = 570;
const CROSSCHECK_START = 1920;
const CROSSCHECK_DURATION = 360;
const SYNTHESIS_START = 2280;
const SYNTHESIS_DURATION = 330;
const CHAT_START = 2610;
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
        durationInFrames={INTRO_DURATION}
        isFirst
        zIndex={1}
      >
        <IntroScene />
      </SceneSequence>
      <SceneSequence
        from={LANDING_START}
        durationInFrames={LANDING_DURATION}
        zIndex={2}
      >
        <LandingScene />
      </SceneSequence>
      <SceneSequence
        from={LOGIN_START}
        durationInFrames={LOGIN_DURATION}
        zIndex={3}
      >
        <LoginScene />
      </SceneSequence>
      <SceneSequence
        from={POST_LOGIN_CHAT_START}
        durationInFrames={POST_LOGIN_CHAT_DURATION}
        zIndex={4}
      >
        <ChatScene animateQueryInput />
      </SceneSequence>
      <SceneSequence
        from={ARCHITECTURE_START}
        durationInFrames={ARCHITECTURE_DURATION}
        zIndex={5}
      >
        <ArchitectureScene />
      </SceneSequence>
      <SceneSequence
        from={CROSSCHECK_START}
        durationInFrames={CROSSCHECK_DURATION}
        zIndex={6}
      >
        <CrossCheckScene />
      </SceneSequence>
      <SceneSequence
        from={SYNTHESIS_START}
        durationInFrames={SYNTHESIS_DURATION}
        zIndex={7}
      >
        <SynthesisScene />
      </SceneSequence>
      <SceneSequence
        from={CHAT_START}
        durationInFrames={CHAT_DURATION}
        zIndex={8}
      >
        <ChatScene />
      </SceneSequence>
    </AbsoluteFill>
  );
};

export const compositionDuration =
  INTRO_DURATION +
  LANDING_DURATION +
  LOGIN_DURATION +
  POST_LOGIN_CHAT_DURATION +
  ARCHITECTURE_DURATION +
  CROSSCHECK_DURATION +
  SYNTHESIS_DURATION +
  CHAT_DURATION;
