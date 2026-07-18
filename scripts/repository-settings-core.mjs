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
  compare(
    errors,
    'default workflow permissions',
    actual.workflowPermissions?.default_workflow_permissions,
    'read'
  );

  const branch = actual.rulesets?.find((ruleset) => ruleset.name === contract.branchRuleset.name);
  const tag = actual.rulesets?.find((ruleset) => ruleset.name === contract.tagRuleset.name);
  if (!branch || branch.enforcement !== 'active' || branch.target !== 'branch') {
    errors.push('active Protected master branch ruleset is missing');
  }
  if (!tag || tag.enforcement !== 'active' || tag.target !== 'tag') {
    errors.push('active Immutable version tags ruleset is missing');
  }
  for (const environment of contract.environments) {
    if (!(actual.environments ?? []).some(({ name }) => name === environment.name)) {
      errors.push(`missing deployment environment: ${environment.name}`);
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
      rulesets: !errors.some((error) => /ruleset/.test(error)),
      environments: !errors.some((error) => /environment/.test(error)),
      pages: !errors.some((error) => /Pages/.test(error)),
    },
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function compare(errors, label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${label} expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}
