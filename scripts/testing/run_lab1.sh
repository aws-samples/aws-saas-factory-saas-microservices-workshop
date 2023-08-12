#!/bin/bash -xe

HOME_DIR="$1"

### START ./2-Lab1/2-1-baseline-product-microservice/index.en.md #
cd "$HOME_DIR"
source ./scripts/set-environment-variables.sh # load env vars such as tls cert and key
CDK_PARAM_DEPLOYMENT_MODE="product" npx cdk deploy PoolBasicStack

aws dynamodb describe-table --table-name "SaaSMicroservices-Products"

kubectl describe serviceaccount product-service-account

ROLE_NAME=$(kubectl get sa product-service-account \
    -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}' \
    | awk -F: '{print $NF}' | awk -F/ '{print $NF}'
    )
aws iam get-role --role-name $ROLE_NAME

RESP=$(aws iam list-role-policies --role-name $ROLE_NAME)
POLICY_NAME=$(echo "${RESP}" | jq -r '.PolicyNames[0]')
aws iam get-role-policy --role-name $ROLE_NAME --policy-name $POLICY_NAME

kubectl describe pod -l app=product-app

kubectl describe service product-service

kubectl describe virtualservice product-vs 

cd "$HOME_DIR"
source ./scripts/set-environment-variables.sh
RESP=$(curl -k --silent --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"product a\",
    \"description\": \"this the first product\",
    \"price\": \"12.99\"
}")
PRODUCT_ID=$(echo "${RESP}" | jq -r '.product.product_id')
curl -k --silent --location --request GET "${LB_HOSTNAME}/products/${PRODUCT_ID}" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" | jq

### END ./2-Lab1/2-1-baseline-product-microservice/index.en.md #

cd "$HOME_DIR"/scripts/testing
python3 lab1_updates.py

### START ./2-Lab1/2-4-deploy-the-microservice/index.en.md #
cd "$HOME_DIR"
./scripts/clean-single-tenant-product.sh
CDK_PARAM_DEPLOYMENT_MODE="product" npx cdk deploy PoolBasicStack

cd "$HOME_DIR"
cat ./tmp/Sample_JWTs.txt

kubectl get namespaces

kubectl get all -n basic-pool

aws dynamodb describe-table --table-name "SaaSMicroservices-Products-basic-pool"

### END ./2-Lab1/2-4-deploy-the-microservice/index.en.md #

### START ./2-Lab1/2-5-test-the-microservice/index.en.md #
curl -k --silent --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"tenant-a product\",
    \"description\": \"this the first product for tenant-a\",
    \"price\": \"12.99\"
}" | jq
curl -k --silent --location --request GET "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_A}" | jq

curl -k --silent --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_D}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"tenant-d product\",
    \"description\": \"this the first product for tenant-d\",
    \"price\": \"99.99\"
}" | jq
curl -k --silent --location --request GET "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN_TENANT_D}" | jq

### END ./2-Lab1/2-5-test-the-microservice/index.en.md #

