import { mockIPC } from "@tauri-apps/api/mocks";
import type { CommandName } from "@/shared/api/commands.ts";

type CommandArgs = Record<string, unknown>;
type CommandHandler = (args: CommandArgs) => unknown;

/** Dialog plugin commands the app calls, mockable alongside its own. */
type PluginCommand = "plugin:dialog|open";

export interface CommandCall {
  command: string;
  args: CommandArgs;
}

/**
 * Answers `invoke` with `handlers`, as the Rust side would; a handler that
 * throws or rejects makes the command fail. An unmocked command fails the call
 * loudly. Returns every call, in order, for assertions.
 */
export function mockCommands(
  handlers: Partial<Record<CommandName | PluginCommand, CommandHandler>>
) {
  const calls: CommandCall[] = [];
  mockIPC((command, args) => {
    const commandArgs = (args ?? {}) as CommandArgs;
    calls.push({ command, args: commandArgs });
    const handler = handlers[command as CommandName | PluginCommand];
    if (!handler) throw new Error(`Unmocked command: ${command}`);
    return handler(commandArgs);
  });
  return calls;
}

/** Delivers `messages` to a `Channel` the frontend passed to a mocked command. */
export function sendToChannel(channel: unknown, ...messages: unknown[]) {
  const { id } = channel as { id: number };
  const internals = (
    window as unknown as {
      __TAURI_INTERNALS__: { runCallback: (id: number, data: unknown) => void };
    }
  ).__TAURI_INTERNALS__;
  messages.forEach((message, index) => internals.runCallback(id, { index, message }));
}

export function callsTo(calls: CommandCall[], command: CommandName) {
  return calls.filter((call) => call.command === command).map((call) => call.args);
}
