#!/bin/bash -x

# STACK_NAME=$(aws cloudformation list-stacks --query "StackSummaries[?StackStatus=='CREATE_COMPLETE' || StackStatus=='UPDATE_COMPLETE'].StackName[?(contains(@,'EKSStack') || contains(@,'eksstack')) && ! contains(@,'Nested')]" --output text)
STACK_NAME="SaaSWorkshopBootstrap"
KUBECONFIG_COMMAND=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?contains(OutputKey,'EKSStackConfigCommand')].OutputValue" --output text)

eval "$KUBECONFIG_COMMAND"
