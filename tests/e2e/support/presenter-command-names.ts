export function getPresenterCommandNames(commands: unknown[]): string[] {
  return commands.map((command) =>
    typeof command === 'object' && command !== null && 'command' in command
      ? String(command.command)
      : 'unknown',
  );
}
