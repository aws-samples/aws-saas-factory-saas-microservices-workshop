#!/bin/bash -xe
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

if [ ! -d "certs" ]; then
    # Directory for generated certs
    mkdir -p certs

    echo "Creating Root CA Cert and Key"
    /usr/bin/openssl req -x509 -sha256 -nodes -days 365 \
        -newkey rsa:2048 \
        -subj '/O=Service CA/CN=serviceca.example.com' \
        -keyout certs/serviceca_example_com.key \
        -out certs/serviceca_example_com.crt

    echo "Creating Cert and Key for Istio Ingress Gateway"
    /usr/bin/openssl req \
        -newkey rsa:2048 -nodes \
        -subj "/O=Cluster 1/CN=*.example.com" \
        -keyout certs/ingressgw_example_com.key \
        -out certs/ingressgw_example_com.csr

    /usr/bin/openssl x509 -req -days 365 \
        -set_serial 0 \
        -CA certs/serviceca_example_com.crt \
        -CAkey certs/serviceca_example_com.key \
        -in certs/ingressgw_example_com.csr \
        -out certs/ingressgw_example_com.crt
fi

CERT=$(base64 certs/ingressgw_example_com.crt | tr -d '[:space:]')
KEY=$(base64 certs/ingressgw_example_com.key | tr -d '[:space:]')
export CDK_PARAM_TLS_CERT_ISTIO="$CERT" # cdk stack params
export CDK_PARAM_TLS_KEY_ISTIO="$KEY" # cdk stack params

echo "Starting cdk deploy..."
yarn install
cdk bootstrap
cdk deploy SaaSMicroserviceBaseStack \
    --require-approval never \
    --no-rollback

echo "Configuring kubeconfig..."
./scripts/configure-kubeconfig.sh

echo "Creating users..."
./scripts/create-users.sh

echo "Setting up evironment variables..."
SOURCE_PATH=$(pwd)
echo "export SOURCE_PATH=${SOURCE_PATH}" | tee -a ~/.bash_profile
echo "source ${SOURCE_PATH}/scripts/set-environment-variables.sh" >>~/.bash_profile

echo "All done, please proceed!"
