#!/bin/bash -x

STACK_NAME="SaaSWorkshopBootstrap"
KUBECONFIG_COMMAND=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?contains(OutputKey,'ConfigCommand')].OutputValue" --output text)

eval "$KUBECONFIG_COMMAND"
