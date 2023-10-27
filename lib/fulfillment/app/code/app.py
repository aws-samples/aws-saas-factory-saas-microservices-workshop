import os
import json
import time
import requests
import logging
import boto3
import jwt
from shared.helper_functions import get_tenant_context, track_metric
from flask import Flask, request

logging.getLogger('boto').setLevel(logging.CRITICAL)
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
event_bus_name = os.environ["EVENT_BUS_NAME"]
event_source = os.environ["EVENT_SOURCE"]
event_detail_type = os.environ["EVENT_DETAIL_TYPE"]
service_name = os.environ["SERVICE_NAME"]
service_type = os.environ["SERVICE_TYPE"]

# LAB 3: REMOVE START (cleanup)


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

        message = json.dumps({
            "order": request.get_json(),
            "tenantId": tenantContext.tenant_id,
            "tenantTier": tenantContext.tenant_tier,
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
                         ", tenant:" + str(tenantContext.tenant_id))
        track_metric(authorization, service_name, service_type,
                     "FulfillmentComplete", 1)
        return {"msg": "Fulfillment successful", "order_id": order_id}, 200

    except Exception as e:
        app.logger.error("Exception raised! " + str(e))
        return {"msg": "Unable to submit fulfillment request!"}, 500
