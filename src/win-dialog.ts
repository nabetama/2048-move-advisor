export interface KeepGoingCandidate {
  tagName: string;
  text: string;
  classes: readonly string[];
}

export function isKeepGoingControl(candidate: KeepGoingCandidate): boolean {
  const isInteractive = candidate.tagName === "BUTTON" || candidate.tagName === "A";
  if (!isInteractive) return false;

  return candidate.classes.includes("keep-playing-button")
    || candidate.text.trim().toLowerCase() === "keep going";
}
