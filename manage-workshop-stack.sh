#!/bin/bash -xe

STACK_OPERATION=$(echo "$1" | tr '[:upper:]' '[:lower:]')

corepack enable
corepack prepare yarn@stable --activate
cd standalone-eks-stack
yarn install
npx cdk bootstrap

if [[ "$STACK_OPERATION" == "create" || "$STACK_OPERATION" == "update" ]]; then
    echo "Starting cdk deploy..."
    npx cdk deploy SaaSWorkshopBootstrap \
        --require-approval never
    echo "Done cdk deploy!"
elif [ "$STACK_OPERATION" == "delete" ]; then
    echo "Starting cdk destroy..."
    npx cdk destroy --all --force
    echo "Done cdk destroy!"
else
    echo "Invalid stack operation!"
    exit 1
fi
