#!/bin/bash -xe

corepack enable
corepack prepare yarn@stable --activate

# check if IS_WORKSHOP_STUDIO_ENV exists and is equal to "yes"
# the $CDK_PARAM_CREATE_CLOUD9_INSTANCE exported env var will be used by CDK
export CDK_PARAM_CREATE_CLOUD9_INSTANCE="false"
if [ "$IS_WORKSHOP_STUDIO_ENV" = "yes" ]; then
    export CDK_PARAM_CREATE_CLOUD9_INSTANCE="true"
fi

echo "Starting cdk deploy..."
cd standalone-eks-stack
yarn install
npx cdk bootstrap

npx cdk deploy SaaSWorkshopBootstrap \
    --require-approval never

echo "Done cdk deploy!"
