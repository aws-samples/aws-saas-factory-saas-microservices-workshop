#!/bin/bash -xe

source ~/.bash_profile

echo "Destroying stacks..."
yarn install
npx cdk bootstrap
npx cdk destroy --all --force

if [ -d "certs" ]; then
    rm -rf certs/
fi
