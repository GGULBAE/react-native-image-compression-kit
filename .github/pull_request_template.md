## Summary

Describe the user-visible behavior and why this change is needed.

## Compatibility and risk

- Platforms/architectures affected:
- Public API or package-shape impact:
- Metadata/privacy or codec impact:
- Release/evidence impact:

## Validation

- [ ] `pnpm verify`
- [ ] `pnpm example:typecheck`
- [ ] `pnpm site:check` and `pnpm site:build` when public docs/site changed
- [ ] `git diff --check`
- [ ] `pnpm pack --dry-run` when package/public API/README changed
- [ ] Relevant Android executable validation or CI authority
- [ ] Relevant iOS executable validation or CI authority
- [ ] README, website, compatibility matrix, and CHANGELOG are current

List any unavailable local check and the CI lane that must provide authority.

## Scope control

- [ ] No credentials, private images, lifecycle scripts, or unrelated generated files are included.
- [ ] New GitHub Actions use reviewed full-SHA pins.
- [ ] Existing release evidence and review archives are unchanged unless this is an explicit evidence import.
