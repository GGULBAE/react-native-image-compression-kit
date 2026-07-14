const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;

export async function resolveGitHubActionTag(
  { repository, releaseTag } = {},
  dependencies = {}
) {
  const requestJson = dependencies.requestJson ?? requestGitHubJson;
  const referenceUrl = githubTagReferenceUrl(repository, releaseTag);
  const referenceResponse = await requestJson(referenceUrl);
  assertRecord(referenceResponse, 'GitHub tag reference response');
  assertRecord(referenceResponse.object, 'GitHub tag reference object');
  assert(
    referenceResponse.ref === `refs/tags/${releaseTag}`,
    `GitHub returned unexpected tag reference ${referenceResponse.ref}.`
  );
  assert(
    referenceResponse.object.type === 'commit' ||
      referenceResponse.object.type === 'tag',
    `GitHub tag reference has unsupported object type ${referenceResponse.object.type}.`
  );
  assert(
    FULL_COMMIT_SHA.test(referenceResponse.object.sha),
    'GitHub tag reference object SHA is not a full commit SHA.'
  );
  assert(
    typeof referenceResponse.object.url === 'string',
    'GitHub tag reference object URL is missing.'
  );

  const tagReference = {
    repository,
    tag: releaseTag,
    ref: referenceResponse.ref,
    url: referenceUrl,
    objectType: referenceResponse.object.type,
    objectSha: referenceResponse.object.sha,
    objectUrl: referenceResponse.object.url,
  };

  if (tagReference.objectType === 'commit') {
    return { tagReference, annotatedTag: null };
  }

  const annotatedUrl = githubGitTagUrl(repository, tagReference.objectSha);
  const annotatedResponse = await requestJson(annotatedUrl);
  assertRecord(annotatedResponse, 'GitHub annotated tag response');
  assertRecord(annotatedResponse.object, 'GitHub annotated tag target');
  assert(
    annotatedResponse.sha === tagReference.objectSha,
    `GitHub returned unexpected annotated tag SHA ${annotatedResponse.sha}.`
  );
  assert(
    annotatedResponse.tag === releaseTag,
    `GitHub returned unexpected annotated tag name ${annotatedResponse.tag}.`
  );
  assert(
    typeof annotatedResponse.object.type === 'string' &&
      typeof annotatedResponse.object.sha === 'string' &&
      typeof annotatedResponse.object.url === 'string',
    'GitHub annotated tag target is incomplete.'
  );

  return {
    tagReference,
    annotatedTag: {
      repository,
      tag: releaseTag,
      sha: annotatedResponse.sha,
      url: annotatedUrl,
      objectType: annotatedResponse.object.type,
      objectSha: annotatedResponse.object.sha,
      objectUrl: annotatedResponse.object.url,
    },
  };
}

export async function requestGitHubJson(
  url,
  { token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? null } = {}
) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'react-native-image-compression-kit-action-pin-review',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, redirect: 'error' });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') detail = body.message;
    } catch {
      // Preserve the HTTP status text when GitHub does not return JSON.
    }
    throw new Error(`GitHub API request failed (${response.status}): ${detail}`);
  }
  return response.json();
}

function githubTagReferenceUrl(repository, releaseTag) {
  return `https://api.github.com/repos/${repository}/git/ref/tags/${encodeURIComponent(releaseTag)}`;
}

function githubGitTagUrl(repository, sha) {
  return `https://api.github.com/repos/${repository}/git/tags/${sha}`;
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
