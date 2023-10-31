import os
import json
import time
import requests
import logging
import boto3
import jwt
from shared.helper_functions import get_tenant_context, create_emf_log, create_emf_log_with_tenant_context
from flask import Flask, request

logging.getLogger('boto').setLevel(logging.CRITICAL)
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
event_bus_name = os.environ["EVENT_BUS_NAME"]
event_source = os.environ["EVENT_SOURCE"]
event_detail_type = os.environ["EVENT_DETAIL_TYPE"]
service_name = os.environ["SERVICE_NAME"]

# LAB 3: REMOVE START (cleanup)


# LAB 3: REMOVE END (cleanup)


@app.route("/fulfillments/health")
def health():
    return {"Status": "OK!"}


@app.route("/fulfillments/<order_id>", methods=['POST'])
def postOrderFulfillment(order_id):
    try:
        authorization = request.headers.get("Authorization", None)
        tenant_context = get_tenant_context(authorization)
        if tenant_context.tenant_id is None:
            return {"msg": "Unable to read 'tenantId' claim from JWT."}, 400

        message = json.dumps({
            "order": request.get_json(),
            "tenantId": tenant_context.tenant_id,
            "tenantTier": tenant_context.tenant_tier,
            "authorization": authorization
        })

        event_bus_client = boto3.client('events')
        response = event_bus_client.put_events(
            Entries=[
                {
                    'Source': event_source,
                    'DetailType': event_detail_type,
                    'Detail': message,
                    'EventBusName': event_bus_name
                }
            ]
        )
        app.logger.debug("Message sent to event bus: " + str(response))
        app.logger.debug("Fulfillment complete: " + str(order_id) +
                         ", tenant:" + str(tenant_context.tenant_id))
        create_emf_log(service_name, "FulfillmentComplete", 1)
        create_emf_log_with_tenant_context(
            service_name, tenant_context, "FulfillmentComplete", 1)
        return {"msg": "Fulfillment successful", "order_id": order_id}, 200

    except Exception as e:
        app.logger.error("Exception raised! " + str(e))
        return {"msg": "Unable to submit fulfillment request!"}, 500
