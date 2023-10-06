import os
import json
import logging
import random
import requests
import boto3
import jwt
# from shared.helper_functions import get_tenant_context, get_boto3_client
from botocore.exceptions import ClientError
from flask import Flask, request
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
from aws_xray_sdk.core.sampling.local.sampler import LocalSampler
from aws_embedded_metrics import metric_scope
from aws_embedded_metrics.storage_resolution import StorageResolution

patch_all()
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
table_name = os.environ["TABLE_NAME"]
xray_service_name = os.environ["AWS_XRAY_SERVICE_NAME"] + \
    "-" + os.environ["POD_NAMESPACE"]
xray_recorder.configure(
    sampling_rules=os.path.abspath("xray_sample_rules.json"),
    service=xray_service_name,
    sampler=LocalSampler()
)
XRayMiddleware(app, xray_recorder)


@metric_scope
def track_metric(tenant, metric_name, count, metrics):
    metrics.put_dimensions({"tenant": tenant})
    metrics.put_dimensions({"ServiceName": xray_service_name})
    metrics.put_dimensions({"ServiceType": "app-service"})
    metrics.put_metric(metric_name, count, "Count", StorageResolution.STANDARD)
    metrics.flush()

# PASTE: LAB1(tenant context)


# REPLACE START: LAB2 (get client)
def get_boto3_client(service):
    return boto3.client(service)
# REPLACE END: LAB2 (get client)


class Product():
    product_id: str
    name: str
    description: str = None
    price: str

    def __init__(self, product_json):
        self.product_id = "prod-" + str(random.randint(10000, 99999))
        self.name = product_json['name']
        self.description = product_json.get('description', '')
        self.price = str(float(product_json['price']))


@app.route("/products/health")
def health():
    return {"message": "Status is Ok!"}


@app.route("/products/<product_id>")
def getProduct(product_id):

    # PASTE: LAB1 (GET route tenant context)

    try:
        dynamodb_client = get_boto3_client("dynamodb")

        # REPLACE START: LAB1 (query DynamoDB with tenant context)
        resp = dynamodb_client.query(
            TableName=table_name,
            KeyConditionExpression='productId=:p_id',
            ExpressionAttributeValues={':p_id': {'S': product_id}}
        )
        # REPLACE END: LAB1 (query DynamoDB with tenant context)

        if len(resp['Items']) < 1:
            return {"msg": "Product not found!", "product_id": product_id}, 404

        product_dict = {
            'productId': product_id,
            'name': resp['Items'][0]['name']['S'],
            'description': resp['Items'][0]['description']['S'],
            'price': resp['Items'][0]['price']['S']
        }

        return {"msg": "GET successful!", "product": product_dict}, 200
    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"msg": "Unable to get product!", "product_id": product_id}, 500


@app.route("/products", methods=['POST'])
def postProduct():

    # PASTE: LAB1 (post tenant context)

    try:
        product = Product(request.get_json())
    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"message": "Error reading product!"}, 400

    try:
        dynamodb_client = get_boto3_client("dynamodb")

        # REPLACE START: LAB1 (DynamoDB put_item with tenant context)
        dynamodb_client.put_item(
            Item={
                'productId': {
                    'S': product.product_id,
                },
                'name': {
                    'S': product.name,
                },
                'description': {
                    'S': product.description,
                },
                'price': {
                    'S': str(product.price),
                },
            },
            TableName=table_name,
        )
        # REPLACE END: LAB1 (DynamoDB put_item with tenant context)

        app.logger.debug("Product created: " + str(product.product_id))
        return {"msg": "Product created", "product": product.__dict__}, 201

    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"msg": "Unable to create product", "product": product.__dict__}, 500


@app.route("/products")
def getAllProduct():
    # IMPLEMENT ME: LAB1 (GET /products)
    pass
