export function openPickerArgs(pluginId = 'tdi.worktree-from-pr', cwd) {
  const args = ['plugin', 'pane', 'open', '--plugin', pluginId, '--entrypoint', 'picker', '--placement', 'overlay', '--focus'];
  // The picker pane otherwise launches in the plugin's install dir; anchor it to
  // the invoking repo so the picker resolves the right repository.
  if (typeof cwd === 'string' && cwd) args.push('--cwd', cwd);
  return args;
}
