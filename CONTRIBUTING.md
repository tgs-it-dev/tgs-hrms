# Contributing to TGS HRMS

## Quick Start

```bash
git clone <repo>
npm install
cp .env.example .env   # fill in DB/Redis/S3 credentials
npm run migration:run
npm run start:dev
```

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production. Direct push is blocked — PRs only. |
| `feature/<ticket>-short-description` | New features |
| `fix/<ticket>-short-description` | Bug fixes |
| `hotfix/<ticket>-short-description` | Urgent production fixes |
| `chore/<description>` | Tooling, deps, CI |

---

## Commit Messages — Conventional Commits (enforced)

Every commit **must** follow this format or the `commit-msg` hook will reject it:

```
type(scope): short description in lower case
```

### Types

| Type | When to use |
|------|------------|
| `feat` | New feature or endpoint |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build, CI, dependency update |
| `revert` | Reverting a previous commit |
| `ci` | CI/CD pipeline changes |

### Examples

```bash
# Good
feat(leave): add monthly leave export endpoint
fix(attendance): correct check-in timezone offset
refactor(auth): extract token validation to helper
test(employee): add unit tests for create employee service
chore(deps): upgrade bullmq to v5

# Bad — will be REJECTED by the hook
minor changes
after pull
Cascade working
notification working in progress
updated the code.
```

---

## Definition of Done

A PR is only ready to merge when **all** of the following are true:

- [ ] **Tests** — At least one unit test covers new logic. `npm test` passes.
- [ ] **No `console.*`** — Use `this.logger.error/warn/log` (NestJS `Logger`) instead.
- [ ] **No `any`** — TypeScript `any` is an ESLint error. Use proper types.
- [ ] **No binary files** — Never commit images, PDFs, or uploads. Store files in S3, save URL in DB.
- [ ] **DTO validation** — All incoming data is validated with `class-validator` decorators.
- [ ] **Lint clean** — `npm run lint` exits with 0 warnings.
- [ ] **Type check clean** — `npx tsc --noEmit` exits with 0 errors.
- [ ] **PR description** filled in — what it does, how it was tested.
- [ ] **Conventional commit title** on the PR.

---

## Code Standards

### Use NestJS Logger — never `console.*`

```typescript
// BAD
console.log('Processing leave request');
console.error('Failed:', err);

// GOOD
import { Logger } from '@nestjs/common';
// In a service:
private readonly logger = new Logger(LeaveService.name);
this.logger.log('Processing leave request');
this.logger.error('Failed to process leave', err.stack);
// In a utility (module-level):
const logger = new Logger('GeofenceUtil');
```

### Phone numbers — use E.164 validation

```typescript
// BAD
@IsString()
phone: string;

// GOOD
@IsPhoneNumber(undefined, { message: 'Provide a valid phone number, e.g. +923001234567' })
phone: string;
```

### Passwords — minimum 8 characters (NIST SP 800-63B)

```typescript
@MinLength(8, { message: 'Password must be at least 8 characters' })
password: string;
```

### Entities — extend BaseEntity

```typescript
// BAD — manual id/timestamps
@PrimaryGeneratedColumn('uuid')
id: string;
@CreateDateColumn()
created_at: Date;

// GOOD
import { BaseEntity } from '../base.entity';
export class Leave extends BaseEntity { ... }
```

### Do NOT commit upload artifacts

Files uploaded by users must be stored in S3. The `public/` directories are in `.gitignore`. If you see a `.png`, `.jpg`, or `.pdf` in your `git status`, remove it.

---

## PR Review Rules (enforced via CODEOWNERS)

| Path | Required reviewer |
|------|-----------------|
| `src/modules/auth/` | @saadtgs |
| `src/common/guards/` | @saadtgs |
| `src/modules/workflow/` | @saadtgs |
| `src/migrations/` | @saadtgs + @adeelasgher847 |
| `src/entities/` | @saadtgs |
| Everything else | @saadtgs or @adeelasgher847 |

All PRs require **at least 2 approvals** before merge.

---

## Running Tests

```bash
npm test                  # run all tests once
npm run test:watch        # watch mode
npm run test:cov          # with coverage report
npm run test:e2e          # end-to-end tests
```

Coverage threshold: **40% lines and functions** (enforced in CI). This minimum will increase each sprint.

---

## Questions?

Ping **@saadtgs** for architecture questions, **@adeelasgher847** for process/CI questions.
