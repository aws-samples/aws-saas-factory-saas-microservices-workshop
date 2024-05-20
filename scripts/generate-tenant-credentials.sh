#!/bin/bash -xe
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

POOLNAME="saas-microservices-workshop-user-pool"
CLIENT_NAME="saas-workshop-client"
JWT_FILE="./tmp/Sample_JWTs.txt"
POOLID=$(aws cognito-idp list-user-pools --max-results 30 --query "UserPools[?Name=='${POOLNAME}'].Id" --output text)
CLIENTID=$(aws cognito-idp list-user-pool-clients --user-pool-id "${POOLID}" --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId" --output text)
CLIENTSECRET=$(aws cognito-idp describe-user-pool-client --user-pool-id "${POOLID}" --client-id "${CLIENTID}" --query "UserPoolClient.ClientSecret" --output text)

if [ -d "tmp" ]; then
    rm -rf tmp/
fi
mkdir ./tmp

tenant_properties=(
    "tenant-a,basic,admin"
    "tenant-b,advanced,admin"
    "tenant-c,premium,admin"
    "tenant-d,basic,admin"
    "tenant-e,advanced,admin"
    "tenant-a,basic,buyer"
    "tenant-a,basic,seller"
    "tenant-b,advanced,buyer"
    "tenant-b,advanced,seller"
    "tenant-c,premium,buyer"
    "tenant-c,premium,seller"
)

echo "=================================================================================" >./tmp/Sample_JWTs.txt
echo "Tenant Id, Tenant Tier, Role, JWT" >>./tmp/Sample_JWTs.txt
echo "=================================================================================" >>./tmp/Sample_JWTs.txt
for ((u = 1; u <= 11; u++)); do
    USER="user"${u}@example.com
    echo "Refreshing token for user: ${USER}"

    export LC_ALL=C
    upp=$(tr -dc 'A-Z' </dev/urandom | head -c2)
    low=$(tr -dc 'a-z' </dev/urandom | head -c2)
    dig=$(tr -dc '0-9' </dev/urandom | head -c2)
    PASSWORD=$(echo "${upp}_${low}@${dig}")

    prop=${tenant_properties[u-1]}    
    IFS=',' read -r tenant_id tier role <<< "$prop"

    aws cognito-idp admin-set-user-password \
        --user-pool-id ${POOLID} \
        --username ${USER} \
        --password ${PASSWORD} \
        --permanent

    HASH=$(python3 ./scripts/secret_hash.py ${USER} ${CLIENTID} ${CLIENTSECRET})

    JWT_TOKEN=$(
        aws cognito-idp initiate-auth \
            --auth-flow USER_PASSWORD_AUTH \
            --client-id ${CLIENTID} \
            --auth-parameters USERNAME=${USER},PASSWORD=${PASSWORD},SECRET_HASH=${HASH} \
            --query 'AuthenticationResult.IdToken' |
            xargs
    )

    echo "${tenant_id}, ${tier}, ${role}, ${JWT_TOKEN}" >>./tmp/Sample_JWTs.txt
    echo "=================================================================================" >>./tmp/Sample_JWTs.txt
done

echo "Sample JWTs are generated in ./tmp/Sample_JWTs.txt"

# set token environment variables
while IFS=',' read -r tenant_id tenant_tier role jwt; do
    # Remove leading and trailing whitespace
    tenant_id=$(echo "$tenant_id" | tr '-' '_' | xargs)
    tenant_tier=$(echo "$tenant_tier" | xargs)
    role=$(echo "$role" | xargs)
    jwt=$(echo "$jwt" | xargs)
    
    if [ -z "$jwt" ]; then  #skip separator lines
        continue;
    fi

    if [ "$role" == "admin" ]; then 
        var="JWT_TOKEN_${tenant_id^^}"
    else
        var="JWT_TOKEN_${tenant_id^^}_${role^^}"
    fi        
    
    export "${var}"="${jwt}"

done < <(tail -n +4 "$JWT_FILE" | head -n -1)

echo "Token variables loaded"
