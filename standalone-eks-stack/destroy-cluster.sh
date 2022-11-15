#!/bin/bash -x

echo "Destroying stacks..."
npx cdk destroy --all --force
