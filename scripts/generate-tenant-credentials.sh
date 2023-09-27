#!/bin/bash -xe

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

echo "=================================================================================" >./tmp/Sample_JWTs.txt
echo "Tenant Id, Tenant Tier, JWT" >>./tmp/Sample_JWTs.txt
echo "=================================================================================" >>./tmp/Sample_JWTs.txt
for ((u = 1; u <= 4; u++)); do
    USER="user"${u}@example.com
    echo "Refreshing token for user: ${USER}"

    export LC_ALL=C
    upp=$(tr -dc 'A-Z' </dev/urandom | head -c2)
    low=$(tr -dc 'a-z' </dev/urandom | head -c2)
    dig=$(tr -dc '0-9' </dev/urandom | head -c2)
    PASSWORD=$(echo "${upp}_${low}@${dig}")

    case ${u} in
    "1") tier="basic" ;;
    "2") tier="advanced" ;;
    "3") tier="premium" ;;
    "4") tier="basic" ;;
    *) tier="none" ;;
    esac

    case ${u} in
    "1") tenant_id="tenant-a" ;;
    "2") tenant_id="tenant-b" ;;
    "3") tenant_id="tenant-c" ;;
    "4") tenant_id="tenant-d" ;;
    *) tenant_id="none" ;;
    esac

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

    echo "${tenant_id}, ${tier}, ${JWT_TOKEN}" >>./tmp/Sample_JWTs.txt
    echo "=================================================================================" >>./tmp/Sample_JWTs.txt
done

echo "Sample JWTs are generated in ./tmp/Sample_JWTs.txt"

export JWT_TOKEN_TENANT_A=$(awk -v ten=tenant-a '$0~ten {print $3}' ${JWT_FILE})
export JWT_TOKEN_TENANT_B=$(awk -v ten=tenant-b '$0~ten {print $3}' ${JWT_FILE})
export JWT_TOKEN_TENANT_C=$(awk -v ten=tenant-c '$0~ten {print $3}' ${JWT_FILE})
export JWT_TOKEN_TENANT_D=$(awk -v ten=tenant-d '$0~ten {print $3}' ${JWT_FILE})

echo "Token variables loaded"
