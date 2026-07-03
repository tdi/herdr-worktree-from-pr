export function resolveBranch(pr, config = {}) {
  const prefix = config.forkBranchPrefix ?? 'pr-';
  if (pr.isCrossRepository) {
    const branchName = `${prefix}${pr.number}`;
    return { fetchRefspec: `pull/${pr.number}/head:${branchName}`, branchName };
  }
  return { fetchRefspec: `${pr.headRefName}:${pr.headRefName}`, branchName: pr.headRefName };
}
