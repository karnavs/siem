# SentryGrid — AI-Augmented SIEM Platform

SentryGrid ingests security events, correlates them into alerts using a rule engine
mapped to MITRE ATT&CK, triages them with an LLM (OpenAI via LangChain), and gives
analysts a console to investigate, act on, and report on threats — with full
RBAC, audit logging, and an AWS deployment that's meant to actually run, not just demo.

> Built as a portfolio-grade reference implementation. The architecture is real
> enough to extend into a genuine product — multi-tenant org isolation is the
> main thing you'd add for that (see `docs/PRODUCTIONIZING.md`).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router, TS), Tailwind CSS, Recharts |
| Backend | Node.js, Express.js, TypeScript |
| Auth | JWT (access + refresh), bcrypt, RBAC (Admin / Analyst / Viewer) |
| Database | PostgreSQL, Prisma ORM |
| AI | OpenAI API via LangChain (alert triage, severity scoring, remediation suggestions) |
| Security | Helmet, CORS allowlist, express-rate-limit, audit log of every privileged action |
| Detection | Rule-based correlation engine mapped to MITRE ATT&CK techniques |
| Infra | Docker, Docker Compose (local), Terraform (AWS) |
| AWS | ECS Fargate, RDS Postgres, S3 (log archive + reports), CloudWatch, CloudTrail, IAM, SNS, EC2 (bastion) |
| CI/CD | GitHub Actions (lint/test/build → ECR → ECS deploy) |
| Testing | Jest, React Testing Library, Postman collection |

## Repo layout

```
secureai-siem/
├── backend/          Express API, Prisma schema, detection engine, AI triage
├── frontend/          Next.js dashboard
├── infra/             Terraform for AWS
├── postman/           API collection
├── docs/              Runbooks
└── .github/workflows/ CI + CD
```

## Quickstart (local)

```bash
cp .env.example .env                  # fill in JWT secrets + (optional) OPENAI_API_KEY
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Postgres: localhost:5432

First run seeds a demo org with three users (passwords match email locals):

| Email | Role |
|---|---|
| admin@sentrygrid.io | ADMIN |
| analyst@sentrygrid.io | ANALYST |
| viewer@sentrygrid.io | VIEWER |

Password for all seed users: `Password123!`

The seed script also generates ~500 synthetic security events and runs them
through the detection engine, so the dashboard isn't empty on first load.

## AI features without a key

If `OPENAI_API_KEY` is unset, `aiTriage.ts` falls back to a deterministic mock
analyzer so the app is fully demoable with zero external dependencies. Drop a
real key into `.env` and restart the backend to switch to live LLM triage —
no code changes needed.

## Pushing to your own GitHub repo

```bash
cd secureai-siem
git init
git add .
git commit -m "Initial commit: SentryGrid SIEM platform"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(`.gitignore` already excludes `node_modules`, `.env`, build output, and
Terraform state — nothing sensitive gets committed.)

## Deploying to AWS

See `infra/README.md` for the full Terraform runbook (VPC, RDS, ECS Fargate,
S3, CloudWatch, CloudTrail, IAM, SNS, bastion EC2) and `.github/workflows/deploy.yml`
for the CI/CD pipeline that builds images, pushes to ECR, and rolls ECS on
every push to `main`.

**Important:** I (Claude) cannot provision AWS resources on your behalf — I
don't have your AWS credentials and this sandbox has no network path to AWS
APIs. Everything under `infra/` is real, applyable Terraform; you run `terraform
apply` from your own machine with your own credentials. The runbook walks
through every step.

## License / commercialization notes

This is your code to license however you like. See `docs/PRODUCTIONIZING.md`
for the gap list between "portfolio demo" and "thing you charge money for"
(multi-tenancy, billing, SOC 2 considerations, log ingestion at scale).
