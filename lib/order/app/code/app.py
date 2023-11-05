import boto3
import jwt
import json
import os
import logging
import requests
import random
from shared.helper_functions import get_tenant_context, get_boto3_client
from aws_embedded_metrics import metric_scope
from flask import Flask, request

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
table_name = os.environ["TABLE_NAME"]
fulfillment_endpoint = os.environ["FULFILLMENT_ENDPOINT"]
service_name = os.environ["SERVICE_NAME"]

class Order():
    order_id: str
    name: str
    tenant_id: str
    description: str = None
    products: list

    def __init__(self, order_json):
        self.order_id = "ord-" + str(random.randint(10000, 99999))
        self.name = order_json['name']
        self.description = order_json.get('description', '')
        self.products = order_json['products']

@metric_scope
def create_emf_log(service_name, metric_name, metric_value, metrics):
    metrics.set_dimensions({"ServiceName": service_name})
    metrics.put_metric(metric_name, metric_value)

@app.route("/orders/health")
def health():
    return {"message": "Status is Ok!"}


@app.route("/orders")
def getAllOrder():
    authorization = request.headers.get("Authorization", None)
    tenant_context = get_tenant_context(authorization)
    if tenant_context.tenant_id is None:
        return {"msg": "Unable to read 'tenantId' claim from JWT."}, 400

    try:
        dynamodb_client = get_boto3_client("dynamodb", authorization)
        resp = dynamodb_client.query(
            TableName=table_name,
            KeyConditionExpression='tenantId = :t_id',
            ExpressionAttributeValues={
                ':t_id': {'S': tenant_context.tenant_id}
            }
        )

        items = resp['Items']
        list = []

        for item in items:
            list.append({
                'order_id': item['orderId']['S'],
                'name': item['name']['S'],
                'description': item['description']['S'],
                'products': item['products']['SS']
            })

        return {"msg": "GET successful! ", "orders": list}, 200

    except Exception as e:
        app.logger.error("Exception raised! " + str(e))
        return {"msg": "Unable to get all orders!"}, 500


@app.route("/orders/<order_id>")
def getOrder(order_id):
    try:
        authorization = request.headers.get("Authorization", None)
        tenant_context = get_tenant_context(authorization)
        if tenant_context.tenant_id is None:
            return {"msg": "Unable to read 'tenantId' claim from JWT."}, 400

        dynamodb_client = get_boto3_client("dynamodb", authorization)
        resp = dynamodb_client.query(
            TableName=table_name,
            KeyConditionExpression='tenantId=:t_id AND order_id=:o_id',
            ExpressionAttributeValues={
                ':t_id': {'S': tenant_context.tenant_id},
                ':o_id': {'S': order_id}
            }
        )

        if len(resp['Items']) < 1:
            return {"msg": "Order not found!", "order_id": order_id}, 404

        order_dict = {
            'order_id': order_id,
            'name': resp['Items'][0]['name']['S'],
            'description': resp['Items'][0]['description']['S'],
            'products': resp['Items'][0]['products']['SS']
        }

        return {"msg": "GET successful! ", "order_id": order_dict}, 200

    except Exception as e:
        app.logger.error("Exception raised! " + str(e))
        return {"msg": "Unable to get order!", "order_id": order_id}, 500


@app.route("/orders", methods=['POST'])
def postOrder():
    try:
        authorization = request.headers.get("Authorization", None)
        tenant_context = get_tenant_context(authorization)
        if tenant_context.tenant_id is None:
            return {"message": "Unable to read 'tenant_id' claim from JWT."}, 400

        order = Order(request.get_json())
        dynamodb_client = get_boto3_client("dynamodb", authorization)
        dynamodb_client.put_item(
            Item={
                'tenantId': {
                    'S': tenant_context.tenant_id,
                },
                'orderId': {
                    'S': order.order_id,
                },
                'name': {
                    'S': order.name,
                },
                'description': {
                    'S': order.description,
                },
                'products': {
                    'SS': order.products,
                },
            },
            TableName=table_name,
        )
        submitFulfillment(order, authorization, tenant_context, fulfillment_endpoint)        
        create_emf_log(service_name, "OrderCreated", 1)
        app.logger.debug("Order created: " + str(order.order_id) + ", tenant:" + str(tenant_context.tenant_id))
        return {"msg": "Order created", "order": order.__dict__}, 200
    except Exception as e:
        app.logger.error("Exception raised! " + str(e))
        return {"msg": "Unable to save order!", "order": order.__dict__}, 500


def submitFulfillment(order, authorization, tenant_context, fulfillment_endpoint):
    # IMPLEMENT ME: LAB3 (submitFulfillment)
    pass
