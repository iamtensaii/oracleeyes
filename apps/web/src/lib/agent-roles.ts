/**
 * Chat persona tag for system prompt + session memory (`save_note`).
 * `adaptive` is the default: one assistant infers intent per message.
 * Other values are legacy / API overrides only — the UI does not expose them.
 */
export type AgentRole =
  | "adaptive"
  | "orchestrator"
  | "research"
  | "risk"
  | "scenario"
  | "decision"
  | "codegen";

const ALL_ROLES: AgentRole[] = [
  "adaptive",
  "orchestrator",
  "research",
  "risk",
  "scenario",
  "decision",
  "codegen",
];

export function parseAgentRole(value: unknown): AgentRole {
  if (typeof value === "string" && (ALL_ROLES as string[]).includes(value)) {
    return value as AgentRole;
  }
  return "adaptive";
}
