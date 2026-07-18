import { describe, expect, it } from 'vitest';
import {
  auditRepositorySettings,
  validateRepositorySettingsContract,
} from '../scripts/repository-settings-core.mjs';

const contract = {
  schemaVersion: 1,
  repository: 'GGULBAE/react-native-image-compression-kit',
  homepage: 'https://ggulbae.github.io/react-native-image-compression-kit/',
  description: 'Capability-aware native image compression, resize, and format conversion for React Native.',
  topics: ['android', 'image-compression', 'image-processing', 'ios', 'new-architecture', 'react-native', 'typescript'],
  features: {
    discussions: true,
    wiki: false,
    privateVulnerabilityReporting: true,
    immutableReleases: true,
    deleteBranchOnMerge: true,
  },
  actions: {
    allowedActions: 'selected',
    shaPinningRequired: true,
    defaultWorkflowPermissions: 'read',
    canApprovePullRequestReviews: false,
    allowedPatterns: ['android-actions/setup-android@*', 'gradle/actions/setup-gradle@*', 'pnpm/action-setup@*', 'reactivecircus/android-emulator-runner@*'],
  },
  branchRuleset: {
    name: 'Protected master',
    target: 'branch',
    include: ['refs/heads/master'],
    requiredApprovals: 0,
    requiredStatusChecks: ['HEIC/HEIF/AVIF emulator validation', 'JS, TypeScript, and Android', 'iOS host-app smoke'],
    requirePullRequest: true,
    requireConversationResolution: true,
    blockDeletion: true,
    blockForcePush: true,
  },
  tagRuleset: {
    name: 'Immutable version tags',
    target: 'tag',
    include: ['refs/tags/v*'],
    blockUpdate: true,
    blockDeletion: true,
  },
  environments: [
    { name: 'github-pages', protectedBranchesOnly: true },
    { name: 'npm-production', protectedBranchesOnly: true, manualApproval: true },
  ],
  communityHealthPercentage: 100,
  pages: { enabled: true, buildType: 'workflow' },
};

describe('repository settings contract', () => {
  it('is explicit and contains no credentials', () => {
    expect(validateRepositorySettingsContract(contract)).toEqual({ ok: true, errors: [] });
  });

  it('audits a matching public repository snapshot', () => {
    const actual = {
      repository: {
        homepage: contract.homepage,
        description: contract.description,
        topics: contract.topics,
        has_discussions: true,
        has_wiki: false,
        delete_branch_on_merge: true,
      },
      privateVulnerability: { enabled: true },
      immutableReleases: { enabled: true },
      actions: { allowed_actions: 'selected', sha_pinning_required: true },
      selectedActions: {
        github_owned_allowed: true,
        verified_allowed: false,
        patterns_allowed: contract.actions.allowedPatterns,
      },
      workflowPermissions: {
        default_workflow_permissions: 'read',
        can_approve_pull_request_reviews: false,
      },
      rulesets: [
        {
          name: 'Protected master',
          target: 'branch',
          enforcement: 'active',
          conditions: { ref_name: { include: ['refs/heads/master'] } },
          rules: [
            { type: 'deletion' },
            { type: 'non_fast_forward' },
            {
              type: 'pull_request',
              parameters: {
                required_approving_review_count: 0,
                required_review_thread_resolution: true,
              },
            },
            {
              type: 'required_status_checks',
              parameters: {
                strict_required_status_checks_policy: true,
                required_status_checks: contract.branchRuleset.requiredStatusChecks.map((context) => ({ context })),
              },
            },
          ],
        },
        {
          name: 'Immutable version tags',
          target: 'tag',
          enforcement: 'active',
          conditions: { ref_name: { include: ['refs/tags/v*'] } },
          rules: [{ type: 'deletion' }, { type: 'update' }],
        },
      ],
      environments: [
        {
          name: 'github-pages',
          deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
          protection_rules: [],
        },
        {
          name: 'npm-production',
          deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
          protection_rules: [{ type: 'required_reviewers', reviewers: [{ reviewer: { login: 'maintainer' } }] }],
        },
      ],
      community: { health_percentage: 100 },
      pages: { build_type: 'workflow' },
    };
    expect(auditRepositorySettings(contract, actual)).toMatchObject({
      status: 'passed',
      error: null,
    });
  });

  it('reports unsafe drift without mutating external settings', () => {
    const report = auditRepositorySettings(contract, {
      repository: { homepage: null, topics: [], has_discussions: false, has_wiki: true },
      privateVulnerability: { enabled: false },
      immutableReleases: { enabled: false },
      actions: { allowed_actions: 'all', sha_pinning_required: false },
      selectedActions: {},
      workflowPermissions: { default_workflow_permissions: 'write' },
      rulesets: [],
      environments: [],
      community: { health_percentage: 57 },
      pages: { build_type: null },
    });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('private vulnerability reporting');
    expect(report.error).toContain('Protected master');
  });
});
