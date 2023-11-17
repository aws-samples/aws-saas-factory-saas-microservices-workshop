#!/bin/bash -x
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

STACK_NAME="SaaSWorkshopBootstrap"
KUBECONFIG_COMMAND=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?contains(OutputKey,'ConfigCommand')].OutputValue" --output text)

eval "$KUBECONFIG_COMMAND"
