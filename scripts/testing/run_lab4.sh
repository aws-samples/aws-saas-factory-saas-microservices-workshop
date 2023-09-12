#!/bin/bash -xe

HOME_DIR="$1"

cd "$HOME_DIR"/scripts/testing
python3 lab4_updates_ingress.py

### START ./5-Lab4/5-1-Ingress-routing/5-1-2-Ingress-routing-deploy/index.en.md #
cd "$HOME_DIR"
source ./scripts/set-environment-variables.sh # load env vars such as tls cert and key
npx cdk deploy PoolBasicStack tenantCstack
sleep 10

kubectl -n istio-system get pods

kubectl -n istio-ingress get pods
kubectl -n istio-ingress get svc

### END ./5-Lab4/5-1-Ingress-routing/5-1-2-Ingress-routing-deploy/index.en.md #

### START ./5-Lab4/5-1-Ingress-routing/5-1-3-Ingress-routing-review/index.en.md #
kubectl -n tenant-c get all

kubectl -n basic-pool get all

kubectl describe namespace tenant-c
kubectl describe service product-service -n tenant-c

kubectl describe namespace basic-pool
kubectl describe service product-service -n basic-pool

kubectl -n tenant-c get vs product-vs \
    -o jsonpath='{.spec}' \
    | jq -r

kubectl -n basic-pool get vs product-vs \
    -o jsonpath='{.spec}' \
    | jq -r

### END ./5-Lab4/5-1-Ingress-routing/5-1-3-Ingress-routing-review/index.en.md #

### START ./5-Lab4/5-1-Ingress-routing/5-1-4-Ingress-routing-testing/index.en.md #
RESP=$(curl -k --silent --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_C}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"tenant-c product\",
    \"description\": \"this the a product for tenant-c\",
    \"price\": \"1850.00\"
}")
PRODUCT_ID=$(echo "${RESP}" | jq -r '.product.product_id')
curl -k --silent --location --request POST "${LB_HOSTNAME}/orders" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_C}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"Tenant-c order\",
    \"description\": \"Tenant-c order description\",
    \"products\": [\"$PRODUCT_ID\"]
}" | jq

kubectl logs -n tenant-c -l app=order-app --tail 10

RESP=$(curl -k --silent --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"tenant-a product\",
    \"description\": \"this the a product for tenant-a\",
    \"price\": \"19.99\"
}")
PRODUCT_ID=$(echo "${RESP}" | jq -r '.product.product_id')
curl -k --silent --location --request POST "${LB_HOSTNAME}/orders" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"Tenant-a order\",
    \"description\": \"Tenant-a order description\",
    \"products\": [\"$PRODUCT_ID\"]
}" | jq

kubectl logs -n basic-pool -l app=order-app --tail 10

### END ./5-Lab4/5-1-Ingress-routing/5-1-4-Ingress-routing-testing/index.en.md #

cd "$HOME_DIR"/scripts/testing
python3 lab4_updates_service_to_service.py

### START ./5-Lab4/5-2-service-to-service-routing/5-2-2-service-to-service-routing-deploy/index.en.md #
cd "$HOME_DIR"
npx cdk deploy PoolBasicStack tenantBstack
sleep 10

kubectl describe ns tenant-b

kubectl -n tenant-b get all

kubectl -n basic-pool get vs fulfillment-vs \
    -o jsonpath='{.spec}' \
    | jq -r

### END ./5-Lab4/5-2-service-to-service-routing/5-2-2-service-to-service-routing-deploy/index.en.md #

### START ./5-Lab4/5-2-service-to-service-routing/5-2-3-service-to-service-routing-testing/index.en.md #
RESP=$(curl -k --silent --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_B}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"tenant-b product\",
    \"description\": \"this the a product for tenant-b\",
    \"price\": \"10.99\"
}")
PRODUCT_ID=$(echo "${RESP}" | jq -r '.product.product_id')
curl -k --silent --location --request POST "${LB_HOSTNAME}/orders" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_B}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"Tenant-b order\",
    \"description\": \"Tenant-b order description\",
    \"products\": [\"$PRODUCT_ID\"]
}" | jq

RESP=$(curl -k --silent --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"tenant-a product\",
    \"description\": \"this the a product for tenant-a\",
    \"price\": \"49.99\"
}")
PRODUCT_ID=$(echo "${RESP}" | jq -r '.product.product_id')
curl -k --silent --location --request POST "${LB_HOSTNAME}/orders" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"Tenant-a order\",
    \"description\": \"Tenant-a order description\",
    \"products\": [\"$PRODUCT_ID\"]
}" | jq

kubectl logs -n basic-pool -l app=order-app --tail 10

kubectl logs -n tenant-b -l app=fulfillment-app --tail 10

kubectl logs -n basic-pool -l app=fulfillment-app --tail 10

### END ./5-Lab4/5-2-service-to-service-routing/5-2-3-service-to-service-routing-testing/index.en.md #
