#!/bin/bash -xe

HOME_DIR="$1"

cd "$HOME_DIR"/scripts/testing
python3 lab2_updates_break.py

### START ./3-Lab2/3-1-app-bug/index.en.md #
cd "$HOME_DIR"
source ./scripts/set-environment-variables.sh # load env vars such as tls cert and key
CDK_PARAM_DEPLOYMENT_MODE="product" npx cdk deploy PoolBasicStack
sleep 10

sleep 10 # wait for pod to update

curl -k --silent --location --request GET "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_D}" | jq

### END ./3-Lab2/3-1-app-bug/index.en.md #

### START ./3-Lab2/3-2-token-vendor-sidecar/index.en.md #
cd "$HOME_DIR"
npx cdk deploy TokenVendorStack
sleep 10

### END ./3-Lab2/3-2-token-vendor-sidecar/index.en.md #

cd "$HOME_DIR"/scripts/testing
python3 lab2_updates_fix.py

### START ./3-Lab2/3-3-modifying-the-product-stack/index.en.md #
cd "$HOME_DIR"
CDK_PARAM_DEPLOYMENT_MODE="product" npx cdk deploy PoolBasicStack
sleep 10

### END ./3-Lab2/3-3-modifying-the-product-stack/index.en.md #

### START ./3-Lab2/3-4-test-isolation/index.en.md #

sleep 10 # wait for pod to update

curl -k --silent --location --request GET "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_D}" | jq

kubectl logs -n basic-pool -l app=product-app --tail 2

### END ./3-Lab2/3-4-test-isolation/index.en.md #

cd "$HOME_DIR"/scripts/testing
python3 lab2_updates_unbreak.py

### START ./3-Lab2/3-5-unbreak-the-service/index.en.md #
cd "$HOME_DIR"
CDK_PARAM_DEPLOYMENT_MODE="product" npx cdk deploy PoolBasicStack
sleep 10

curl -k --silent --location --request GET "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_D}" | jq

### END ./3-Lab2/3-5-unbreak-the-service/index.en.md #

