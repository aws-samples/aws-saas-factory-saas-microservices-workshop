#!/bin/bash -xe

corepack enable
corepack prepare yarn@stable --activate

echo "Starting cdk deploy..."
cd standalone-eks-stack
yarn install
npx cdk bootstrap

npx cdk deploy SaaSWorkshopBootstrap \
    --require-approval never

echo "Done cdk deploy!"
