from aws_embedded_metrics.storage_resolution import StorageResolution
from aws_embedded_metrics import metric_scope
import jwt
import boto3
import os
import requests
import json
from flask.logging import default_handler
from shared.log_formatter import CustomFormatter
default_handler.setFormatter(CustomFormatter())


class TenantContext:
    tenant_id: str = None
    tenant_tier: str = None

    def __init__(self, jwt):
        self.tenant_id = jwt.get('custom:tenant_id', None)
        self.tenant_tier = jwt.get('custom:tenant_tier', None)


def get_tenant_context(authorization):
    token = authorization.replace("Bearer ", "")
    decoded_token = jwt.decode(token, options={"verify_signature": False})
    print("Decoded JWT: " + str(decoded_token))
    return TenantContext(decoded_token)


def get_boto3_client(service, authorization=None):
    token_vendor_endpoint = "127.0.0.1"
    token_vendor_endpoint_port = os.environ["TOKEN_VENDOR_ENDPOINT_PORT"]
    url = "http://" + token_vendor_endpoint + ":" + token_vendor_endpoint_port
    print("Token Vendor URL: " + url)
    response = requests.get(
        url,
        headers={
            "Authorization": authorization
        }
    ).json()

    access_key = response["Credentials"]["AccessKeyId"]
    secret_key = response["Credentials"]["SecretAccessKey"]
    session_token = response["Credentials"]["SessionToken"]

    return boto3.client(
        service,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        aws_session_token=session_token
    )


@metric_scope
def track_metric(authorization, service_name, service_type, metric_name, count, metrics):
    tenantContext = get_tenant_context(authorization)
    metrics.set_dimensions({
        "TenantId": tenantContext.tenant_id,
        "TenantTier": tenantContext.tenant_tier,
        "ServiceName": service_name,
        "ServiceType": service_type,
    })
    metrics.put_metric(metric_name, count, "Count", StorageResolution.STANDARD)


def log_info_message(app, message, tenantContext):
    message_dict = {
        'message': message,
        'tenantTier': tenantContext.tenant_tier,
        'tenantId': tenantContext.tenant_id
    }
    app.logger.info(json.dumps(message_dict))