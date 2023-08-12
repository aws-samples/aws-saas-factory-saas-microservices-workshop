#!/bin/bash -xe

HOME_DIR="$1"

### START ./1-introduction/2-environment-setup/2-on-your-own/p7-install-cloud9-tools.en.md #
# cd "$HOME_DIR"
# ./setup.sh

### END ./1-introduction/2-environment-setup/2-on-your-own/p7-install-cloud9-tools.en.md #

### START ./1-introduction/2-environment-setup/2-on-your-own/p8-create-cluster.en.md #
cd "$HOME_DIR"/standalone-eks-stack
./deploy-cluster.sh

kubectl get namespaces

### END ./1-introduction/2-environment-setup/2-on-your-own/p8-create-cluster.en.md #

### START ./1-introduction/2-environment-setup/2-on-your-own/p9-deploy-base.en.md #
cd "$HOME_DIR"
echo "{}" > cdk.context.json # clear cached values in context (otherwise we reuse old, non-existing ssm parameter values)
./deploy.sh

kubectl get namespaces

aws cognito-idp list-user-pools --max-results 20 --query 'UserPools[?Name==`saas-microservices-workshop-user-pool`]'

### END ./1-introduction/2-environment-setup/2-on-your-own/p9-deploy-base.en.md #
