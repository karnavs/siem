terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Remote state is strongly recommended for anything beyond a solo demo.
  # Uncomment and point at an S3 bucket + DynamoDB lock table you control:
  #
  # backend "s3" {
  #   bucket         = "sentrygrid-tfstate-<your-account-id>"
  #   key            = "sentrygrid/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "sentrygrid-tf-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "sentrygrid"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
