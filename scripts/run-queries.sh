#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

source scripts/set-environment-variables.sh
echo "HOST: $HOST"
echo "Hostname: $LB_HOSTNAME"
echo "JWT_FILE: $JWT_FILE"

echo "Starting..."
for i in {1..20}; do
    echo "Iteration: $i"
    for tenant_id in "tenant-a" "tenant-b" "tenant-c" "tenant-d" "tenant-e"; do
        echo "################# Running queries for tenant: ${tenant_id}... #################"
        token_var_seller="JWT_TOKEN_$(echo "${tenant_id^^}" | tr '-' '_')_SELLER"
        JWT_TOKEN_SELLER=${!token_var_seller}
        token_var_buyer="JWT_TOKEN_$(echo "${tenant_id^^}" | tr '-' '_')_BUYER"
        JWT_TOKEN_BUYER=${!token_var_buyer}

        echo "Creating new product..."
        DESCRIPTION="this is a description with a random number: ${RANDOM}"
        if [ "$tenant_id" = "tenant-e" ]; then
            PRICE="$((RANDOM * 10)).99" # increase product price for tenant-e
        else
            PRICE="${RANDOM}.99"
        fi
        RESP=$(curl --silent -k --location --request POST "${LB_HOSTNAME}/products" \
            --header "Host: ${HOST}" \
            --header "Authorization: Bearer ${JWT_TOKEN_SELLER}" \
            --header 'Content-Type: application/json' \
            --data-raw "{
                \"name\": \"${tenant_id}-product-${RANDOM}\",
                \"description\": \"${DESCRIPTION}\",
                \"price\": \"${PRICE}\"
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
            --header "Authorization: Bearer ${JWT_TOKEN_SELLER}")

        if [ "$DESCRIPTION" = "$(echo "${RESP}" | jq -r '.product.description')" ]; then
            echo "Successfully retrieved product!"
        else
            echo "Error retrieving product!"
            echo "Response received:"
            echo "$RESP"
            exit 1
        fi

        if [ "$tenant_id" = "tenant-b" ]; then
            for j in {1..3}; do
                echo "Submitting new order..."
                RESP=$(curl --silent -k --location --request POST "${LB_HOSTNAME}/orders" \
                    --header "Host: ${HOST}" \
                    --header "Authorization: Bearer ${JWT_TOKEN_BUYER}" \
                    --header 'Content-Type: application/json' \
                    --data-raw "{
              \"name\": \"${tenant_id}-order-${j}${RANDOM}\",
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
            done
        else
            echo "Submitting new order..."
            RESP=$(curl --silent -k --location --request POST "${LB_HOSTNAME}/orders" \
                --header "Host: ${HOST}" \
                --header "Authorization: Bearer ${JWT_TOKEN_BUYER}" \
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
        fi
        echo "################# All queries returned successfully for tenant: ${tenant_id}... #################"
    done
done

echo "Done!"
