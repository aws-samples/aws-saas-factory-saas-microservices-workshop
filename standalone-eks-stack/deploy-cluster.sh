#!/bin/bash -xe

# This script is meant to be run as part of the
# "on-your-own" flow of the saas microservices workshop.
#

echo "Starting cdk deploy..."
yarn install
npx cdk bootstrap
npx --yes cdk deploy eksBlueprintStack/EKSStack \
    --require-approval never \
    --parameters EksBlueprintStack:createCloud9Instance=false

echo "Done cdk deploy!"

echo "Configuring kubeconfig..."
../scripts/configure-kubeconfig.sh

echo "Done!"
