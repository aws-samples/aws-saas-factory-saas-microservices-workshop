#!/bin/bash

sudo yum -y install jq
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 10")
AWS_REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
C9_INSTANCE_ID=$(aws ec2 describe-instances --region $AWS_REGION --filters Name=tag:Name,Values=*Workshop-Instance* --query "Reservations[*].Instances[*].InstanceId" --output text)
aws ec2 associate-iam-instance-profile --iam-instance-profile Name=saas-factory-microservices-workshop-admin --region $AWS_REGION --instance-id $C9_INSTANCE_ID
