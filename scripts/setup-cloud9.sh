#!/bin/bash -xe

sudo apt install install -y jq

TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 15")
AWS_REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
C9_INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/instance-id)
INSTANCE_PROFILE_NAME=$(aws ssm get-parameter --name "/saas-workshop/cloud9InstanceProfileName" --region "$AWS_REGION" --query 'Parameter.Value' --output text)
aws ec2 associate-iam-instance-profile --iam-instance-profile Name="$INSTANCE_PROFILE_NAME" --region "$AWS_REGION" --instance-id "$C9_INSTANCE_ID"
