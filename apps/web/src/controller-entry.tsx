import { useState } from "react";
import { App as ControllerApp } from "@hubbub/controller";
import { transitionView } from "@hubbub/ui";
import { Settings } from "../../controller/src/settings";
import { loadIdentity, saveIdentity, type Identity } from "../../controller/src/identity";
import { WelcomeScreen } from "./welcome";
import { JoinScreen } from "./join";

type Phase = "welcome" | "avatar" | "join" | "live";

/** Phone-side gate: welcome (first run) -> avatar picker -> join, every later visit
 * skipping straight to join. "live" hands off to the real ControllerApp untouched. */
export function ControllerEntry({ onHostInstead }: { onHostInstead: () => void }) {
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());
  const [phase, setPhase] = useState<Phase>(identity ? "join" : "welcome");
  const [joinCode, setJoinCode] = useState("");

  if (phase === "live") {
    return <ControllerApp key="live" initialCode={joinCode} />;
  }

  if (phase === "welcome") {
    return <WelcomeScreen onContinue={() => transitionView(() => setPhase("avatar"))} />;
  }

  if (phase === "avatar") {
    return (
      <Settings
        initial={identity ?? undefined}
        onCancel={identity ? () => transitionView(() => setPhase("join")) : undefined}
        onSave={(id) => {
          saveIdentity(id);
          setIdentity(id);
          transitionView(() => setPhase("join"));
        }}
      />
    );
  }

  return (
    <JoinScreen
      identity={identity!}
      onEditIdentity={() => transitionView(() => setPhase("avatar"))}
      onJoin={(code) => {
        setJoinCode(code);
        transitionView(() => setPhase("live"));
      }}
      onHostInstead={onHostInstead}
    />
  );
}
