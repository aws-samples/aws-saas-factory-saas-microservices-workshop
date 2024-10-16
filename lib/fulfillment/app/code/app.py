# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import os
import json
import time
import requests
import logging
import boto3
import jwt
from shared.helper_functions import get_tenant_context
from aws_embedded_metrics.logger.metrics_logger_factory import create_metrics_logger
from flask import Flask, request

logging.getLogger("boto").setLevel(logging.CRITICAL)
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
event_bus_name = os.environ["EVENT_BUS_NAME"]
event_source = os.environ["EVENT_SOURCE"]
event_detail_type = os.environ["EVENT_DETAIL_TYPE"]
service_name = os.environ["SERVICE_NAME"]


async def create_emf_log(service_name, metric_name, metric_value):
    logger = create_metrics_logger()
    logger.set_dimensions({"ServiceName": service_name})
    logger.put_metric(metric_name, metric_value)
    await logger.flush()


@app.route("/fulfillments/health")
def health():
    return {"Status": "OK!"}


@app.route("/fulfillments/<order_id>", methods=["POST"])
async def postOrderFulfillment(order_id):
    try:
        authorization = request.headers.get("Authorization", None)
        tenant_context = get_tenant_context(authorization)
        if tenant_context.tenant_id is None:
            return {"msg": "Unable to read \"tenantId\" claim from JWT."}, 400

        # IMPLEMENT BELOW: LAB3 assign me to message with tenant context
        message_detail = None
        
        event_bus_client = boto3.client("events")
        event_bus_client.put_events(
            Entries=[
                {
                    "Source": event_source,
                    "DetailType": event_detail_type,
                    "Detail": message_detail,
                    "EventBusName": event_bus_name
                }
            ]
        )

        app.logger.debug(
            f"Message sent to event bus: {order_id}, tenant: {tenant_context.tenant_id}")
        app.logger.debug(
            f"Fulfillment complete: {order_id}, tenant: {tenant_context.tenant_id}")
        await create_emf_log(service_name, "FulfillmentComplete", 1)
        return {"msg": "Fulfillment successful", "order_id": order_id}, 200

    except Exception as e:
        app.logger.error(f"Exception raised! {e}")
        return {"msg": "Unable to submit fulfillment request!"}, 500
