const REQUIRED_TOPICS = [
  'android',
  'image-compression',
  'image-processing',
  'ios',
  'new-architecture',
  'react-native',
  'typescript',
];
const REQUIRED_CHECKS = [
  'HEIC/HEIF/AVIF emulator validation',
  'JS, TypeScript, and Android',
  'iOS host-app smoke',
];

export function validateRepositorySettingsContract(contract) {
  const errors = [];
  if (contract?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (contract?.repository !== 'GGULBAE/react-native-image-compression-kit') {
    errors.push('repository identity is not canonical');
  }
  if (contract?.homepage !== 'https://ggulbae.github.io/react-native-image-compression-kit/') {
    errors.push('homepage is not the canonical Pages URL');
  }
  if (JSON.stringify(contract).toLowerCase().includes('token')) {
    errors.push('repository settings contract must not contain tokens');
  }
  const topics = [...(contract?.topics ?? [])].sort();
  if (JSON.stringify(topics) !== JSON.stringify(REQUIRED_TOPICS)) {
    errors.push('topics do not match the exact public discovery contract');
  }
  for (const [field, expected] of Object.entries({
    discussions: true,
    wiki: false,
    privateVulnerabilityReporting: true,
    immutableReleases: true,
    deleteBranchOnMerge: true,
  })) {
    if (contract?.features?.[field] !== expected) {
      errors.push(`feature ${field} must be ${expected}`);
    }
  }
  if (contract?.actions?.allowedActions !== 'selected') {
    errors.push('Actions must use a selected allowlist');
  }
  if (contract?.actions?.shaPinningRequired !== true) {
    errors.push('Actions SHA pinning must be required');
  }
  if (contract?.actions?.canApprovePullRequestReviews !== false) {
    errors.push('Actions must not approve pull request reviews');
  }
  if (
    JSON.stringify([...(contract?.actions?.allowedPatterns ?? [])].sort()) !==
    JSON.stringify([
      'android-actions/setup-android@*',
      'gradle/actions/setup-gradle@*',
      'pnpm/action-setup@*',
      'reactivecircus/android-emulator-runner@*',
    ])
  ) {
    errors.push('Actions selected allowlist patterns drifted');
  }
  if (contract?.actions?.defaultWorkflowPermissions !== 'read') {
    errors.push('default workflow permissions must be read');
  }
  const checks = [...(contract?.branchRuleset?.requiredStatusChecks ?? [])].sort();
  if (JSON.stringify(checks) !== JSON.stringify(REQUIRED_CHECKS)) {
    errors.push('branch ruleset required checks drifted');
  }
  for (const field of [
    'requirePullRequest',
    'requireConversationResolution',
    'blockDeletion',
    'blockForcePush',
  ]) {
    if (contract?.branchRuleset?.[field] !== true) {
      errors.push(`branch ruleset ${field} must be true`);
    }
  }
  if (
    contract?.tagRuleset?.blockUpdate !== true ||
    contract?.tagRuleset?.blockDeletion !== true
  ) {
    errors.push('version tag updates and deletions must be blocked');
  }
  const environments = (contract?.environments ?? []).map(({ name }) => name).sort();
  if (JSON.stringify(environments) !== JSON.stringify(['github-pages', 'npm-production'])) {
    errors.push('github-pages and npm-production environments are required');
  }
  if (contract?.communityHealthPercentage !== 100) {
    errors.push('community health target must be 100');
  }
  if (contract?.pages?.enabled !== true || contract?.pages?.buildType !== 'workflow') {
    errors.push('Pages must be enabled with a workflow build');
  }
  return { ok: errors.length === 0, errors };
}

export function auditRepositorySettings(contract, actual) {
  const errors = [];
  const contractReport = validateRepositorySettingsContract(contract);
  errors.push(...contractReport.errors);
  compare(errors, 'homepage', actual.repository?.homepage, contract.homepage);
  compare(errors, 'description', actual.repository?.description, contract.description);
  compare(errors, 'discussions', actual.repository?.has_discussions, true);
  compare(errors, 'wiki', actual.repository?.has_wiki, false);
  compare(errors, 'delete branch on merge', actual.repository?.delete_branch_on_merge, true);
  const actualTopics = [...(actual.repository?.topics ?? [])].sort();
  compare(errors, 'topics', actualTopics, contract.topics);
  compare(errors, 'private vulnerability reporting', actual.privateVulnerability?.enabled, true);
  compare(errors, 'immutable releases', actual.immutableReleases?.enabled, true);
  compare(errors, 'Actions allowed_actions', actual.actions?.allowed_actions, 'selected');
  compare(errors, 'Actions SHA pinning', actual.actions?.sha_pinning_required, true);
  compare(errors, 'Actions GitHub-owned allowance', actual.selectedActions?.github_owned_allowed, true);
  compare(errors, 'Actions verified allowance', actual.selectedActions?.verified_allowed, false);
  compare(
    errors,
    'Actions selected patterns',
    [...(actual.selectedActions?.patterns_allowed ?? [])].sort(),
    [...contract.actions.allowedPatterns].sort()
  );
  compare(
    errors,
    'default workflow permissions',
    actual.workflowPermissions?.default_workflow_permissions,
    'read'
  );
  compare(
    errors,
    'Actions pull request review approval',
    actual.workflowPermissions?.can_approve_pull_request_reviews,
    false
  );

  const branch = actual.rulesets?.find((ruleset) => ruleset.name === contract.branchRuleset.name);
  const tag = actual.rulesets?.find((ruleset) => ruleset.name === contract.tagRuleset.name);
  if (!branch || branch.enforcement !== 'active' || branch.target !== 'branch') {
    errors.push('active Protected master branch ruleset is missing');
  } else {
    compare(errors, 'Protected master include', branch.conditions?.ref_name?.include, contract.branchRuleset.include);
    const rules = ruleMap(branch.rules);
    if (!rules.has('deletion')) errors.push('Protected master deletion rule is missing');
    if (!rules.has('non_fast_forward')) errors.push('Protected master force-push rule is missing');
    const pullRequest = rules.get('pull_request')?.parameters;
    compare(
      errors,
      'Protected master required approvals',
      pullRequest?.required_approving_review_count,
      contract.branchRuleset.requiredApprovals
    );
    compare(
      errors,
      'Protected master conversation resolution',
      pullRequest?.required_review_thread_resolution,
      true
    );
    const statusChecks = rules.get('required_status_checks')?.parameters;
    compare(
      errors,
      'Protected master required status checks',
      [...(statusChecks?.required_status_checks ?? [])].map(({ context }) => context).sort(),
      [...contract.branchRuleset.requiredStatusChecks].sort()
    );
    compare(errors, 'Protected master strict status checks', statusChecks?.strict_required_status_checks_policy, true);
  }
  if (!tag || tag.enforcement !== 'active' || tag.target !== 'tag') {
    errors.push('active Immutable version tags ruleset is missing');
  } else {
    compare(errors, 'Immutable version tags include', tag.conditions?.ref_name?.include, contract.tagRuleset.include);
    const rules = ruleMap(tag.rules);
    if (!rules.has('deletion')) errors.push('Immutable version tags deletion rule is missing');
    if (!rules.has('update')) errors.push('Immutable version tags update rule is missing');
  }
  for (const environment of contract.environments) {
    const deployed = (actual.environments ?? []).find(({ name }) => name === environment.name);
    if (!deployed) {
      errors.push(`missing deployment environment: ${environment.name}`);
      continue;
    }
    compare(
      errors,
      `${environment.name} protected branches`,
      deployed.deployment_branch_policy?.protected_branches,
      environment.protectedBranchesOnly
    );
    compare(
      errors,
      `${environment.name} custom branch policies`,
      deployed.deployment_branch_policy?.custom_branch_policies,
      false
    );
    if (environment.manualApproval) {
      const reviewers = deployed.protection_rules?.find(({ type }) => type === 'required_reviewers');
      if (!reviewers || (reviewers.reviewers ?? []).length === 0) {
        errors.push(`${environment.name} manual approval reviewer is missing`);
      }
    }
  }
  compare(
    errors,
    'community health percentage',
    actual.community?.health_percentage,
    contract.communityHealthPercentage
  );
  compare(errors, 'Pages build type', actual.pages?.build_type, 'workflow');

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    repository: contract.repository,
    checks: {
      metadata: !errors.some((error) => /homepage|description|topics/.test(error)),
      community: !errors.some((error) => /discussions|wiki|community/.test(error)),
      security: !errors.some((error) => /vulnerability|immutable/.test(error)),
      actions: !errors.some((error) => /Actions|workflow permissions/.test(error)),
      rulesets: !errors.some((error) => /ruleset|Protected master|Immutable version/.test(error)),
      environments: !errors.some((error) => /environment/.test(error)),
      pages: !errors.some((error) => /Pages/.test(error)),
    },
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function ruleMap(rules) {
  return new Map((rules ?? []).map((rule) => [rule.type, rule]));
}

function compare(errors, label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${label} expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}
