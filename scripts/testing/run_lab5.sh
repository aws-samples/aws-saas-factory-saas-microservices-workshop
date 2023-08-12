#!/bin/bash -xe

HOME_DIR="$1"

cd "$HOME_DIR"/scripts/testing
python3 lab5_updates_logs.py

### START ./6-Lab5/6-2-creating-tenant-aware-metrics-from-logs/index.en.md #
cd "$HOME_DIR"
npx cdk deploy --all

kubectl get pods -n basic-pool

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

cd "$HOME_DIR"
./scripts/run-queries.sh

### END ./6-Lab5/6-2-creating-tenant-aware-metrics-from-logs/index.en.md #

cd "$HOME_DIR"/scripts/testing
python3 lab5_updates_xray.py

### START ./6-Lab5/6-3-tracing-with-aws-x-ray/index.en.md #
cd "$HOME_DIR"
npx cdk deploy --all

cd "$HOME_DIR"
./scripts/run-queries.sh

cd "$HOME_DIR"
./scripts/run-queries.sh

### END ./6-Lab5/6-3-tracing-with-aws-x-ray/index.en.md #
