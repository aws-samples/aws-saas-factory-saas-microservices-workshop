#!/bin/bash -xe

# This script is meant to be run as part of the
# "on-your-own" flow of the saas microservices workshop.

echo "Starting cdk deploy..."

# Use the same method that workshop studio uses to deploy standalone stack
aws cloudformation deploy \
    --template-file WorkshopStack.yaml \
    --stack-name workshopStack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        RepoUrl="https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop.git" \
        RepoBranchName="v2" \
        IsWorkshopStudioEnv="no"
