## What does this PR do?

<!-- A clear, 1-3 sentence description of the change. -->

## Type of change

- [ ] `feat` — New feature
- [ ] `fix` — Bug fix
- [ ] `refactor` — Code refactor (no behavior change)
- [ ] `perf` — Performance improvement
- [ ] `test` — Adding/updating tests
- [ ] `docs` — Documentation only
- [ ] `chore` — Build, CI, dependency updates

## How was it tested?

<!-- Describe what you tested and how. At minimum: manual steps to verify the change works. -->

- [ ] Unit tests added / updated
- [ ] Tested manually in local environment
- [ ] Tested against staging

## Checklist

- [ ] Commit message follows conventional commits format (`type(scope): description`)
- [ ] No `console.log/warn/error` — using `Logger` instead
- [ ] No binary files (images, PDFs, etc.) committed
- [ ] No hardcoded secrets or credentials
- [ ] DTOs have validation decorators (`@IsString`, `@IsEmail`, etc.)
- [ ] New endpoints are guarded (`@UseGuards(JwtAuthGuard)`)

## Does this touch security-sensitive code?

<!-- Auth, JWT, permissions, file uploads, tenant isolation? Tag @saad-tgs for review. -->

- [ ] Yes — tagged Saad for review
- [ ] No

## Related issue / ticket

<!-- Link to Jira/Linear/GitHub issue if applicable -->
Closes #
