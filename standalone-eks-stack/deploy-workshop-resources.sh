#!/bin/bash -e

# This script is meant to be run as part of the
# "on-your-own" flow of the saas microservices workshop.

echo "Deploying workshop resources..."

STACK_NAME="WorkshopStack"
REPO_URL="https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop.git"
REPO_BRANCH_NAME="v2"
PARTICIPANT_ASSUMED_ROLE_ARN="$(aws sts get-caller-identity --query 'Arn' --output text)"

aws cloudformation create-stack \
    --stack-name "$STACK_NAME" \
    --template-body file://WorkshopStack.yaml \
    --capabilities CAPABILITY_IAM \
    --parameters \
        ParameterKey=RepoUrl,ParameterValue="$REPO_URL" \
        ParameterKey=RepoBranchName,ParameterValue="$REPO_BRANCH_NAME" \
        ParameterKey=ParticipantAssumedRoleArn,ParameterValue="$PARTICIPANT_ASSUMED_ROLE_ARN"

echo "CloudFormation stack $STACK_NAME creation started. You can monitor progress in the AWS Console at https://console.aws.amazon.com/cloudformation"
