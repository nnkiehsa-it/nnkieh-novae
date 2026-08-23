const supportedIssueIds = new Set<string>();

export function clearSupportedIssueMemory() {
  supportedIssueIds.clear();
}

export function getSupportedIssueIdsSnapshot() {
  return new Set(supportedIssueIds);
}

export function rememberSupportedIssue(issueId: string, supported: boolean) {
  if (supported) supportedIssueIds.add(issueId);
  else supportedIssueIds.delete(issueId);
}
