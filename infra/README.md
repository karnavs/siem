# Deploying SentryGrid to AWS

This provisions: VPC (public+private subnets, NAT), RDS Postgres, ECS Fargate
(backend + frontend), an ALB, ECR repos, S3 (log archive), CloudWatch
(logs+alarms), CloudTrail, SNS (critical alert emails), IAM (including a
GitHub Actions OIDC role so CI can deploy without stored AWS keys), and a
bastion EC2 for direct DB access.

**I (Claude) wrote this Terraform and it's ready to apply, but I haven't run
`terraform plan`/`apply` myself** — this sandbox has no network path to AWS
APIs, and even if it did, applying infrastructure into *your* AWS account
needs *your* credentials, which should never be pasted into a chat. Everything
below is what you run yourself, from your own machine.

## 0. Prerequisites

- An AWS account with billing enabled
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured (`aws configure`)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- An existing EC2 key pair in your target region (for bastion SSH) — create one in the EC2 console if you don't have one
- Docker installed locally (to build/push images the first time, before CI takes over)

Estimated cost: roughly $60–90/month running 24/7 at the smallest sizes used
here (NAT gateway and RDS are the biggest line items). Shut it down with
`terraform destroy` when you're not using it, or shrink `db_instance_class`
further / drop the NAT gateway to a scheduled one if cost matters more than uptime.

## 1. Configure variables

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
- `db_password`, `jwt_access_secret`, `jwt_refresh_secret` — generate each with `openssl rand -hex 32`
- `alert_notification_email` — where critical-alert emails go
- `bastion_allowed_ssh_cidr` — run `curl ifconfig.me` and use `<that-ip>/32`
- `bastion_key_pair_name` — your existing EC2 key pair name
- `github_org_repo` — `your-username/your-repo`, used to scope the OIDC trust policy

`terraform.tfvars` is gitignored — it will never be committed.

## 2. Provision the infrastructure

```bash
terraform init
terraform plan    # review what it's about to create
terraform apply   # type "yes" when prompted
```

This takes 10–15 minutes (RDS and the NAT gateway are the slow parts). When
it finishes, note the outputs — especially `alb_dns_name`,
`ecr_backend_repository_url`, `ecr_frontend_repository_url`, and
`github_actions_deploy_role_arn`.

## 3. First image push (manual, before CI takes over)

```bash
aws ecr get-login-password --region <your-region> | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Backend
docker build -t sentrygrid-backend ../backend
docker tag sentrygrid-backend:latest <ecr_backend_repository_url>:latest
docker push <ecr_backend_repository_url>:latest

# Frontend (point it at the ALB so the browser calls the right API)
docker build -t sentrygrid-frontend ../frontend \
  --build-arg NEXT_PUBLIC_API_URL=http://<alb_dns_name>
docker tag sentrygrid-frontend:latest <ecr_frontend_repository_url>:latest
docker push <ecr_frontend_repository_url>:latest
```

Then force a fresh deployment so the ECS services pick up these images:

```bash
aws ecs update-service --cluster <ecs_cluster_name> --service sentrygrid-production-backend --force-new-deployment
aws ecs update-service --cluster <ecs_cluster_name> --service sentrygrid-production-frontend --force-new-deployment
```

## 4. Initialize the database schema

The ECS tasks don't run migrations automatically (production migrations
should be a deliberate step, not something that happens on every task
restart). From your machine, tunnel through the bastion:

```bash
# SSH to the bastion (uses the key pair you set in bastion_key_pair_name)
ssh -i /path/to/your-key.pem ec2-user@<bastion_public_ip>

# From the bastion, connect to RDS directly (psql was installed via user_data)
psql "postgresql://sentrygrid:<db_password>@<rds_endpoint>/sentrygrid"
```

Easier: generate the schema from your local machine through an SSH tunnel,
then apply it once:

```bash
ssh -i /path/to/your-key.pem -L 5433:<rds_endpoint_no_port>:5432 ec2-user@<bastion_public_ip> -N &

cd ../backend
DATABASE_URL="postgresql://sentrygrid:<db_password>@localhost:5433/sentrygrid" npx prisma migrate dev --name init
DATABASE_URL="postgresql://sentrygrid:<db_password>@localhost:5433/sentrygrid" npx prisma db seed
```

Commit the generated `backend/prisma/migrations/` folder — from then on,
`prisma migrate deploy` (already wired into the backend Docker image's normal
boot path for local dev; add it as an ECS one-off task or CI step for prod)
will apply new migrations on deploy instead of `db push`.

## 5. Visit the app

```
http://<alb_dns_name>
```

Log in with the seeded demo credentials from the main README, or register a
new org from the UI.

## 6. Hook up CI/CD

In your GitHub repo settings → Secrets and variables → Actions, add:
- `AWS_DEPLOY_ROLE_ARN` = the `github_actions_deploy_role_arn` output
- `AWS_REGION` = your region
- `ECR_BACKEND_REPO` / `ECR_FRONTEND_REPO` = the two repository URLs
- `ECS_CLUSTER` = the `ecs_cluster_name` output

From here, every push to `main` runs `.github/workflows/deploy.yml`, which
builds both images, pushes to ECR, and forces a new ECS deployment — no AWS
keys stored in GitHub, since it assumes the OIDC role.

## 7. Going to production for real

Before charging anyone money for this, at minimum:
- Put the ALB behind HTTPS (ACM cert + Route 53 domain + HTTPS listener)
- Turn on RDS Multi-AZ (already auto-enabled when `environment = "production"`)
- Move `prisma migrate deploy` into a dedicated CI step or one-off ECS task
  rather than running it from a laptop
- Add WAF in front of the ALB
- Review `docs/PRODUCTIONIZING.md` for the multi-tenancy and scaling gaps

## Tearing it down

```bash
terraform destroy
```

This deletes everything Terraform created, including the database. Take a
final RDS snapshot first if you want to keep the data (the `production`
environment already does this automatically via `final_snapshot_identifier`).
