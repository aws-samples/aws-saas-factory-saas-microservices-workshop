#!/bin/bash -xe
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

export CDK_PARAM_TLS_CERT_ISTIO="ready to delete"
export CDK_PARAM_TLS_KEY_ISTIO="ready to delete"

echo "Destroying stacks..."
yarn install
npx cdk bootstrap
npx cdk destroy --all --force

if [ -d "certs" ]; then
    rm -rf certs/
fi
