#!/bin/bash -xe

HOME_DIR="$1"

cd "$HOME_DIR"/scripts/testing
python3 lab3_updates.py

### START ./4-Lab3/4-1-introducing-library/index.en.md #

cd "$HOME_DIR"
source ./scripts/set-environment-variables.sh # load env vars such as tls cert and key
CDK_PARAM_DEPLOYMENT_MODE="all" npx cdk deploy PoolBasicStack
sleep 10

### END ./4-Lab3/4-1-introducing-library/index.en.md #

### START ./4-Lab3/4-3-testing/index.en.md #
kubectl get all -n basic-pool
kubectl get vs -n basic-pool

RESP=$(curl -k --silent --location --request GET "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}")
PRODUCT_ID=$(echo "${RESP}" | jq -r '.products[0].productId')
curl -k --silent --location --request POST "${LB_HOSTNAME}/orders" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"Tenant-a Order\",
    \"description\": \"Tenant-a Order Description\",
    \"products\": [\"$PRODUCT_ID\"]
}" | jq

RESP=$(curl -k --silent --location --request GET "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_D}")
PRODUCT_ID=$(echo "${RESP}" | jq -r '.products[0].productId')
curl -k --silent --location --request POST "${LB_HOSTNAME}/orders" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_D}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"tenant-d Order\",
    \"description\": \"tenant-d Order Description\",
    \"products\": [\"$PRODUCT_ID\"]
}" | jq

kubectl logs -n basic-pool -l app=order-app --tail 6

kubectl logs -n basic-pool -l app=fulfillment-app --tail 4

### END ./4-Lab3/4-3-testing/index.en.md #
