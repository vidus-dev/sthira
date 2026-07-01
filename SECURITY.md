# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in this project, please report it
privately. **Do not open a public issue, pull request, or discussion** for
security problems.

To report:

1. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
   ("Report a vulnerability" under the repository's **Security** tab), or
2. Contact the maintainers directly through the repository owner's GitHub profile.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept where possible).
- Affected component(s) — `fin-backend`, `fin-front`, `fin-mobile`, or infra.
- Any suggested remediation.

We aim to acknowledge reports within a few business days and will keep you
informed as we work on a fix. Please give us a reasonable window to remediate
before any public disclosure.

## Supported versions

This project is pre-1.0 and under active development. Security fixes are applied
to the `main` branch. There is no long-term-support branch yet.

## Handling of sensitive data

This is a personal-finance application. When reporting or reproducing issues,
**never** include real financial data, credentials, or secrets in issues, PRs,
logs, or screenshots. Use synthetic data.

## Security practices in this repo

- **Static analysis** — CodeQL scans Python and JavaScript/TypeScript on every
  push/PR and weekly.
- **Dependency updates** — Dependabot proposes patches for known-vulnerable deps.
- **Secret hygiene** — `SECRET_KEY` must be strong (≥32 chars, non-placeholder)
  in staging/production, enforced at startup.
- **Defense in depth** — CSRF protection on authenticated writes, login
  throttling, RFC 7807 error responses, and request-id correlation in logs.
