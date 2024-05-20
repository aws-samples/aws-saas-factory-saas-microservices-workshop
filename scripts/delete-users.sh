#!/bin/bash -x
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

POOLNAME="saas-microservices-workshop-user-pool"
POOLID=$(aws cognito-idp list-user-pools --max-results 30 --query "UserPools[?Name=='${POOLNAME}'].Id" --output text)

for ((u = 1; u <= 11; u++)); do
    USER="user"${u}@example.com
    echo "Deleting ${USER} in ${POOLNAME}"

    aws cognito-idp admin-disable-user \
        --user-pool-id "${POOLID}" \
        --username "${USER}"

    aws cognito-idp admin-delete-user \
        --user-pool-id "${POOLID}" \
        --username "${USER}"
done

if [ -d "tmp" ]; then
    rm -rf tmp/
fi
