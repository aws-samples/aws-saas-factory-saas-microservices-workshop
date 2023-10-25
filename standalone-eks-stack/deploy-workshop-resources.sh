#!/bin/bash -xe

# This script is meant to be run as part of the
# "on-your-own" flow of the saas microservices workshop.

echo "Deploying workshop resources..."

REPO_URL="https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop.git"
REPO_BRANCH_NAME="v2"
PARTICIPANT_ASSUMED_ROLE_ARN="$(aws sts get-caller-identity --query 'Arn' --output text)"

# Use the same method that workshop studio uses to deploy standalone stack
aws cloudformation create-stack \
    --template-file WorkshopStack.yaml \
    --stack-name workshopStack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        RepoUrl="$REPO_URL" \
        RepoBranchName="$REPO_BRANCH_NAME" \
        ParticipantAssumedRoleArn="$PARTICIPANT_ASSUMED_ROLE_ARN"

echo "CloudFormation stack creation started. You can monitor progress in the AWS Console at https://console.aws.amazon.com/cloudformation"
