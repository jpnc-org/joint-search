import "./index.css";
import { Composition } from "remotion";
import { MyComposition, compositionDuration } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DeepResearchDemo"
        component={MyComposition}
        durationInFrames={compositionDuration}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
