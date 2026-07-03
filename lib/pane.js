export function openPickerArgs(pluginId = 'tdi.worktree-from-pr', cwd) {
  const args = ['plugin', 'pane', 'open', '--plugin', pluginId, '--entrypoint', 'picker', '--placement', 'split', '--direction', 'right', '--focus'];
  // Pass the invoking repo as HERDR_WFP_CWD (resolveRepo prefers it over the pane's
  // own context JSON, which points at the plugin dir). Do NOT set --cwd: the pane
  // command `node bin/picker.js` is relative to the plugin root, so the pane must
  // launch there — --cwd would break command resolution.
  if (typeof cwd === 'string' && cwd) args.push('--env', `HERDR_WFP_CWD=${cwd}`);
  return args;
}
