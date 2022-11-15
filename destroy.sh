#!/bin/bash -x

if [ -d "certs" ]; then
    rm -rf certs/
fi

echo "Destroying stacks..."
npx cdk destroy --all --force
