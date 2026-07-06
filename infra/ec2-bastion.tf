data "aws_ami" "amazon_linux" {
  count       = var.enable_bastion ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "bastion" {
  count                       = var.enable_bastion ? 1 : 0
  ami                         = data.aws_ami.amazon_linux[0].id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.bastion[0].id]
  key_name                    = var.bastion_key_pair_name
  associate_public_ip_address = true

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  root_block_device {
    volume_size = 8
    encrypted   = true
  }

  user_data = <<-EOF
    #!/bin/bash
    dnf install -y postgresql16
  EOF

  tags = { Name = "${local.name}-bastion" }
}

output "bastion_public_ip" {
  value       = var.enable_bastion ? aws_instance.bastion[0].public_ip : null
  description = "SSH here, then psql to the RDS endpoint to run initial migrations"
}
