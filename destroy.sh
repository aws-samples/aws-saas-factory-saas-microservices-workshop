#!/bin/bash -xe

if [ -d "certs" ]; then
    rm -rf certs/
fi

echo "Destroying stacks..."
yarn install
npx cdk bootstrap
npx cdk destroy --all --force
