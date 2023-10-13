import os
import json
import time
import requests
import logging
import boto3
import jwt
# from shared.helper_functions import get_tenant_context
from flask import Flask, request
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
from aws_xray_sdk.core.sampling.local.sampler import LocalSampler
patch_all()
logging.getLogger('boto').setLevel(logging.CRITICAL)
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
queue_url = os.environ["QUEUE_URL"]
xray_service_name = os.environ["AWS_XRAY_SERVICE_NAME"] + \
    "-" + os.environ["POD_NAMESPACE"]
xray_recorder.configure(
    sampling_rules=os.path.abspath("xray_sample_rules.json"),
    service=xray_service_name,
    sampler=LocalSampler()
)
XRayMiddleware(app, xray_recorder)

# LAB 3: REMOVE START (cleanup)


class TenantContext:
    tenant_id: str = None
    tenant_tier: str = None

    def __init__(self, jwt):
        self.tenant_id = jwt.get('custom:tenant_id', None)
        self.tenant_tier = jwt.get('custom:tenant_tier', None)


def get_tenant_context(authorization):
    token = authorization.replace("Bearer ", "")
    decoded_token = jwt.decode(token, options={"verify_signature": False})
    return TenantContext(decoded_token)
# LAB 3: REMOVE END (cleanup)


@app.route("/fulfillments/health")
def health():
    return {"Status": "OK!"}


@app.route("/fulfillments/<order_id>", methods=['POST'])
def postOrderFulfillment(order_id):
    try:
        authorization = request.headers.get("Authorization", None)
        tenantContext = get_tenant_context(authorization)
        if tenantContext.tenant_id is None:
            return {"msg": "Unable to read 'tenantId' claim from JWT."}, 400

        sqs_client = boto3.client(
            "sqs", endpoint_url="https://sqs.{}.amazonaws.com".format(os.environ["AWS_DEFAULT_REGION"]))
        sqs_client.send_message(
            QueueUrl=queue_url,
            MessageAttributes={
                'tenant_id': {
                    'StringValue': tenantContext.tenant_id,
                    'DataType': 'String'
                },
                'order_id': {
                    'StringValue': order_id,
                    'DataType': 'String'
                }
            },
            MessageBody=json.dumps({
                "order": request.get_json(),
                "authorization": authorization
            })

        app.logger.debug("Fulfillment complete: " + str(order_id) +
                         ", tenant:" + str(tenantContext.tenant_id))
        return {"msg": "Fulfillment successful", "order_id": order_id}, 200

    except Exception as e:
        app.logger.error("Exception raised! " + str(e))
        return {"msg": "Unable to submit fulfillment request!"}, 500
