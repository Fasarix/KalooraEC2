# ── IAM Role & Instance Profile per i Nodi EC2 ───────────────────────────────

resource "aws_iam_role" "ec2_k8s_node_role" {
  name = "${var.project_name}-ec2-k8s-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ec2-k8s-role"
  }
}

# Policy per accesso a DynamoDB, SQS, ECR e SSM con Principio di Minimo Privilegio (Least Privilege)
resource "aws_iam_policy" "kaloora_services_access" {
  name        = "${var.project_name}-services-access-policy"
  description = "Policy per consentire ai pod sui nodi EC2 di accedere a DynamoDB, SQS, ECR e SSM"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          aws_dynamodb_table.diary.arn,
          aws_dynamodb_table.foods.arn,
          "${aws_dynamodb_table.diary.arn}/index/*",
          "${aws_dynamodb_table.foods.arn}/index/*"
        ]
      },
      {
        Sid    = "SQSAccess"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          aws_sqs_queue.diary_events.arn,
          aws_sqs_queue.diary_dlq.arn
        ]
      },
      {
        Sid    = "ECRAuthToken"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRRepositoryPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = [for s in aws_ecr_repository.services : s.arn]
      },
      {
        Sid    = "SSMParametersAccess"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "ssm:PutParameter",
          "ssm:DeleteParameter"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "kaloora_policy_attach" {
  role       = aws_iam_role.ec2_k8s_node_role.name
  policy_arn = aws_iam_policy.kaloora_services_access.arn
}

# Attach AWS Systems Manager (SSM) policy for secure, portless instance management
resource "aws_iam_role_policy_attachment" "ssm_managed_instance_core" {
  role       = aws_iam_role.ec2_k8s_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "k8s_node_profile" {
  name = "${var.project_name}-k8s-node-profile"
  role = aws_iam_role.ec2_k8s_node_role.name
}

