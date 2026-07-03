export function openPickerArgs(pluginId = 'tdi.worktree-from-pr') {
  return ['plugin', 'pane', 'open', '--plugin', pluginId, '--entrypoint', 'picker', '--placement', 'overlay', '--focus'];
}
