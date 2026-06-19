import { AbsoluteFill, Sequence } from "remotion";
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
const ORCHESTRATOR_START = 870;
const ORCHESTRATOR_DURATION = 300;
const PLANNER_START = 1170;
const PLANNER_DURATION = 360;
const RESEARCHERS_START = 1530;
const RESEARCHERS_DURATION = 360;
const CROSSCHECK_START = 1890;
const CROSSCHECK_DURATION = 360;
const SYNTHESIS_START = 2250;
const SYNTHESIS_DURATION = 330;
const CHAT_START = 2580;
const CHAT_DURATION = 210;

export const MyComposition = () => {
  return (
    <AbsoluteFill className="bg-background text-foreground">
      <Sequence durationInFrames={COLD_OPEN_DURATION}>
        <ColdOpenScene />
      </Sequence>
      <Sequence from={PROBLEM_START} durationInFrames={PROBLEM_DURATION}>
        <ProblemScene />
      </Sequence>
      <Sequence from={LANDING_START} durationInFrames={LANDING_DURATION}>
        <LandingScene />
      </Sequence>
      <Sequence from={LOGIN_START} durationInFrames={LOGIN_DURATION}>
        <LoginScene />
      </Sequence>
      <Sequence from={ORCHESTRATOR_START} durationInFrames={ORCHESTRATOR_DURATION}>
        <OrchestratorScene />
      </Sequence>
      <Sequence from={PLANNER_START} durationInFrames={PLANNER_DURATION}>
        <PlannerScene />
      </Sequence>
      <Sequence from={RESEARCHERS_START} durationInFrames={RESEARCHERS_DURATION}>
        <ResearchersScene />
      </Sequence>
      <Sequence from={CROSSCHECK_START} durationInFrames={CROSSCHECK_DURATION}>
        <CrossCheckScene />
      </Sequence>
      <Sequence from={SYNTHESIS_START} durationInFrames={SYNTHESIS_DURATION}>
        <SynthesisScene />
      </Sequence>
      <Sequence from={CHAT_START} durationInFrames={CHAT_DURATION}>
        <ChatScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export const compositionDuration =
  COLD_OPEN_DURATION +
  PROBLEM_DURATION +
  LANDING_DURATION +
  LOGIN_DURATION +
  ORCHESTRATOR_DURATION +
  PLANNER_DURATION +
  RESEARCHERS_DURATION +
  CROSSCHECK_DURATION +
  SYNTHESIS_DURATION +
  CHAT_DURATION;
