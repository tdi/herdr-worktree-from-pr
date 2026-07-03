export function openPickerArgs(pluginId = 'tdi.worktree-from-pr', cwd) {
  const args = ['plugin', 'pane', 'open', '--plugin', pluginId, '--entrypoint', 'picker', '--placement', 'overlay', '--focus'];
  // The picker pane otherwise launches in the plugin's install dir; anchor it to
  // the invoking repo. --cwd sets the pane's working dir; HERDR_WFP_CWD is the
  // authoritative signal resolveRepo prefers over the pane's own context JSON.
  if (typeof cwd === 'string' && cwd) args.push('--cwd', cwd, '--env', `HERDR_WFP_CWD=${cwd}`);
  return args;
}
