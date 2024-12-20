#!/bin/bash -xe
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

POOLNAME="saas-microservices-workshop-user-pool"
CLIENT_NAME="saas-workshop-client"

POOLID=$(aws cognito-idp list-user-pools --max-results 30 --query "UserPools[?Name=='${POOLNAME}'].Id" --output text)
USER_ATTR=Name="custom:tenant_id"
USER_ATTR2=Name="custom:tenant_tier"
USER_ATTR3=Name="custom:role"
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
    "tenant-d,basic,buyer"
    "tenant-d,basic,seller"
    "tenant-e,advanced,buyer"
    "tenant-e,advanced,seller"
)

echo "=================================================================================" >./tmp/Sample_JWTs.txt
echo "Tenant Id, Tenant Tier, Role, JWT" >>./tmp/Sample_JWTs.txt
echo "=================================================================================" >>./tmp/Sample_JWTs.txt
for ((u = 1; u <= 15; u++)); do
    USER="user"${u}@example.com
    echo "Creating ${USER} in ${POOLNAME}"

    export LC_ALL=C
    upp=$(tr -dc 'A-Z' </dev/urandom | head -c2)
    low=$(tr -dc 'a-z' </dev/urandom | head -c2)
    dig=$(tr -dc '0-9' </dev/urandom | head -c2)
    PASSWORD=$(echo "${upp}_${low}@${dig}")

    prop=${tenant_properties[u-1]}    
    IFS=',' read -r tenant_id tier role <<< "$prop"

    aws cognito-idp admin-create-user \
        --user-pool-id ${POOLID} \
        --username ${USER} \
        --user-attributes Name=email,Value=${USER} ${USER_ATTR},Value="${tenant_id}" ${USER_ATTR2},Value="${tier}" ${USER_ATTR3},Value="${role}" \
        --no-paginate \
        --no-cli-pager

    aws cognito-idp admin-set-user-password \
        --user-pool-id ${POOLID} \
        --username ${USER} \
        --password ${PASSWORD} \
        --permanent \
        --no-paginate \
        --no-cli-pager

    aws cognito-idp admin-update-user-attributes \
        --user-pool-id ${POOLID} \
        --username ${USER} \
        --user-attributes Name="email_verified",Value="true" \
        --no-paginate \
        --no-cli-pager

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
