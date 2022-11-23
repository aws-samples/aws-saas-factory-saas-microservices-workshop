#!/bin/bash

source scripts/set-environment-variables.sh
echo "HOST: $HOST"
echo "Hostname: $LB_HOSTNAME"
echo "JWT_FILE: $JWT_FILE"

echo "Starting tests..."
for tenant_id in "tenant-a" "tenant-b" "tenant-c" "tenant-d"; do
    echo "################# Running queries for tenant: ${tenant_id}... #################"
    JWT_TOKEN=$(awk -v tenant_id=$tenant_id '$0~tenant_id {print $3}' ${JWT_FILE})

    echo "Creating new product..."
    DESCRIPTION="this is a description with a random number: ${RANDOM}"
    RESP=$(curl --silent -k --location --request POST "${LB_HOSTNAME}/products" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"${tenant_id}-product-${RANDOM}\",
    \"description\": \"${DESCRIPTION}\",
    \"price\": \"${RANDOM}.99\"
}")

    PRODUCT_ID=$(echo "${RESP}" | jq -r '.product.product_id')
    if [ -n "$PRODUCT_ID" ]; then
        echo "Successfully created a new product!"
    else
        echo "Error creating product!"
        echo "Response received:"
        echo "$RESP"
        exit 1
    fi

    echo "Getting newly created product: ${PRODUCT_ID}..."
    RESP=$(curl --silent -k --location --request GET "${LB_HOSTNAME}/products/${PRODUCT_ID}" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN}")

    if [ "$DESCRIPTION" = "$(echo "${RESP}" | jq -r '.product.description')" ]; then
        echo "Successfully retrieved product!"
    else
        echo "Error retrieving product!"
        echo "Response received:"
        echo "$RESP"
        exit 1
    fi

    echo "Submitting new order..."
    RESP=$(curl --silent -k --location --request POST "${LB_HOSTNAME}/orders" \
        --header "Host: ${HOST}" \
        --header "Authorization: Bearer ${JWT_TOKEN}" \
        --header 'Content-Type: application/json' \
        --data-raw "{
    \"name\": \"${tenant_id}-order-${RANDOM}\",
    \"description\": \"this is a description with a random number: ${RANDOM}\",
    \"products\": [\"${PRODUCT_ID}\"]
}")

    MESSAGE=$(echo "${RESP}" | jq -r '.msg')
    if [ "$MESSAGE" = "Order created" ]; then
        echo "Successfully submitted order!"
    else
        echo "Error submittting order!"
        echo "Response received:"
        echo "$RESP"
        exit 1
    fi
    echo "################# All queries returned successfully for tenant: ${tenant_id}... #################"

    sleep 5
done
echo "Done!"
