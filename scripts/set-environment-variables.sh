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

export JWT_TOKEN_TENANT_A=$(awk -v ten=tenant-a '$0~ten {print $3}' ${JWT_FILE})
export JWT_TOKEN_TENANT_B=$(awk -v ten=tenant-b '$0~ten {print $3}' ${JWT_FILE})
export JWT_TOKEN_TENANT_C=$(awk -v ten=tenant-c '$0~ten {print $3}' ${JWT_FILE})
export JWT_TOKEN_TENANT_D=$(awk -v ten=tenant-d '$0~ten {print $3}' ${JWT_FILE})
export JWT_TOKEN_TENANT_E=$(awk -v ten=tenant-e '$0~ten {print $3}' ${JWT_FILE})
export CDK_PARAM_TLS_CERT_ISTIO="$(base64 $SOURCE_PATH/certs/ingressgw_example_com.crt | tr -d '[:space:]')"
export CDK_PARAM_TLS_KEY_ISTIO="$(base64 $SOURCE_PATH/certs/ingressgw_example_com.key | tr -d '[:space:]')"
