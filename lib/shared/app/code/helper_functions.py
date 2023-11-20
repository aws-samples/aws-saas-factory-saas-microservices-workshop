# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import jwt
import boto3
import os
import requests
import json
from aws_embedded_metrics.logger.metrics_logger_factory import create_metrics_logger

# IMPLEMENT ME: LAB1 (TenantContext and get_tenant_context)


# IMPLEMENT ME: LAB2 (get_boto3_resource)
def get_boto3_resource(service, authorization=None): # todo: remove me after updating narrative
    token_vendor_endpoint = "127.0.0.1"
    token_vendor_endpoint_port = os.environ["TOKEN_VENDOR_ENDPOINT_PORT"]
    url = f"http://{token_vendor_endpoint}:{token_vendor_endpoint_port}"
    response = requests.get(
        url,
        headers={
            "Authorization": authorization
        }
    ).json()

    access_key = response["Credentials"]["AccessKeyId"]
    secret_key = response["Credentials"]["SecretAccessKey"]
    session_token = response["Credentials"]["SessionToken"]

    return boto3.resource(
        service,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        aws_session_token=session_token
    )


# IMPLEMENT ME: LAB3 (get_message_detail_with_tenant_context)


# IMPLEMENT ME: LAB3 (get_tenant_context_from_message_detail)


# IMPLEMENT ME: LAB5 (create_emf_log_with_tenant_context)
