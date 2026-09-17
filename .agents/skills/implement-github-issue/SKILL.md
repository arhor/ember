---
name: implement-github-issue
description: Implement a GitHub issue or ticket from repository investigation through a ready pull request. Use when the user asks to implement, fix, or complete a GitHub issue and expects the code change and PR, not when they only want issue triage, planning, or review.
---

# Implement a GitHub Issue

Own the requested issue through implementation and pull-request creation.

## Establish the contract

1. Resolve the target repository and issue from the user's request and the current checkout. Use authenticated GitHub tooling to read the issue title, body, labels, current state, and requirement-bearing comments.
2. Determine whether GitHub records a parent issue or epic. Prefer the native parent/sub-issue relationship; also follow an explicit parent-epic link in the issue when the relationship is represented in prose. Do not treat a milestone, dependency, related issue, or incidental mention as a parent.
3. If a parent epic exists, read its title, body, and requirement-bearing comments before deciding how to implement the child. Use it to understand shared intent, terminology, constraints, and acceptance criteria. Keep the implementation scoped to the child issue unless the child cannot be completed without a clearly necessary adjacent change.
4. Inspect repository instructions and relevant durable documentation before making implementation decisions. Reconcile the issue with the current code and tests; if requirements conflict materially or the target issue cannot be identified, stop and explain the blocker rather than guessing.

## Implement and verify

- Check the worktree and current branch before editing. Preserve unrelated user changes and avoid mixing them into the issue branch or commit.
- Create or switch to an appropriately named feature branch when needed. Do not rewrite or discard existing work.
- Implement the smallest complete change that satisfies the child issue in the context of its parent epic. Add or update behavior-focused tests and durable documentation when the repository's conventions or changed contracts require them.
- Run the repository-required formatting, linting, and relevant tests. Investigate failures and distinguish failures caused by the change from unrelated baseline failures.
- Review the final diff against the issue's acceptance criteria and the parent epic's applicable constraints. Do not claim criteria that were not verified.

## Deliver the pull request

1. Commit only the intended issue changes with a clear commit message, then push the feature branch to the appropriate remote.
2. Create a pull request against the repository's intended base branch. Use a concise title and a body that summarizes the change, lists verification performed, and links the child issue with a supported closing keyword when completion should close it.
3. Mention the parent epic for context when one exists, but do not use a closing keyword for the epic unless the work actually completes it and the user requested that outcome.
4. Return the pull-request URL and briefly report the implemented outcome and verification. If authentication, repository permissions, branch protection, or unavailable GitHub metadata prevents completion, preserve the local work and report the exact remaining step.
