#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# Check if required env variables are set
# If they are not set, this script will set them.
# Otherwise, it will not change them.
#
# To use, run the following:
# $ source set-environment-variable.sh
# $ echo $LB_HOSTNAME
#

if [ -z "$SOURCE_PATH" ]; then
    export SOURCE_PATH="."
fi

export JWT_FILE="$SOURCE_PATH/tmp/Sample_JWTs.txt"
export HOST="saas-workshop.example.com"
export LB_HOSTNAME=$(bash $SOURCE_PATH/scripts/get-loadbalancer-hostname.sh)

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

export CDK_PARAM_TLS_CERT_ISTIO="$(base64 $SOURCE_PATH/certs/ingressgw_example_com.crt | tr -d '[:space:]')"
export CDK_PARAM_TLS_KEY_ISTIO="$(base64 $SOURCE_PATH/certs/ingressgw_example_com.key | tr -d '[:space:]')"
