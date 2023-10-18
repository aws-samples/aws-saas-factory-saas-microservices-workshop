import os
import json
import logging
import random
import requests
import boto3
import jwt
from shared.helper_functions import get_tenant_context, get_boto3_client, track_metric
from botocore.exceptions import ClientError
from flask import Flask, request
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
from aws_xray_sdk.core.sampling.local.sampler import LocalSampler

patch_all()
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
table_name = os.environ["TABLE_NAME"]
service_name = os.environ["SERVICE_NAME"]
service_type = os.environ["SERVICE_TYPE"]
xray_recorder.configure(
    sampling_rules=os.path.abspath("xray_sample_rules.json"),
    service=service_name,
    sampler=LocalSampler()
)
XRayMiddleware(app, xray_recorder)


# REPLACE START: LAB2 (get client)
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
    # Read the HTTP Authorization header
    authorization = request.headers.get("Authorization", None)
    tenantContext = get_tenant_context(
        authorization)  # Get tenant context from token
    if tenantContext.tenant_id is None:
        return {"msg": "Invalid 'tenantId' claim."}, 400
    xray_recorder.put_annotation("tenant_id", tenantContext.tenant_id)

    try:
        dynamodb_client = get_boto3_client("dynamodb", authorization)

        # REPLACE START: LAB1 (DynamoDB query with tenant context)
        resp = dynamodb_client.query(
            TableName=table_name,
            # query by tenant-id and product-id
            KeyConditionExpression='tenantId=:t_id AND productId=:p_id',
            ExpressionAttributeValues={
                # setting tenant-id from context
                ':t_id': {'S': tenantContext.tenant_id},
                ':p_id': {'S': product_id}
            }
        )
        # REPLACE END: LAB1 (DynamoDB query with tenant context)

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
    # Read the HTTP Authorization header
    authorization = request.headers.get("Authorization", None)
    tenantContext = get_tenant_context(
        authorization)  # Get tenant context from token
    if tenantContext.tenant_id is None:
        return {"msg": "Invalid 'tenantId' claim."}, 400
    xray_recorder.put_annotation("tenant_id", tenantContext.tenant_id)

    try:
        product = Product(request.get_json())
    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"message": "Error reading product!"}, 400

    try:
        dynamodb_client = get_boto3_client("dynamodb", authorization)

        # REPLACE START: LAB1 (DynamoDB put_item with tenant context)
        dynamodb_client.put_item(
            Item={
                'tenantId': {
                    'S': tenantContext.tenant_id,     # tenant-id from tenant context
                },
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
        track_metric(authorization, service_name, service_type,
                     "ProductCreated", 1)
        return {"msg": "Product created", "product": product.__dict__}, 201

    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"msg": "Unable to create product", "product": product.__dict__}, 500


@app.route("/products")
def getAllProduct():
    # IMPLEMENT ME: LAB1 (GET /products)
    try:
        authorization = request.headers.get("Authorization", None)
        tenantContext = get_tenant_context(authorization)
        if tenantContext.tenant_id is None:
            return {"msg": "Unable to read 'tenantId' claim from JWT."}, 400
        xray_recorder.put_annotation("tenant_id", tenantContext.tenant_id)

        dynamodb_client = get_boto3_client("dynamodb", authorization)

        resp = dynamodb_client.query(
            TableName=table_name,
            KeyConditionExpression='tenantId = :t_id',
            ExpressionAttributeValues={
                # REPLACE LINE BELOW: lab1 (bug)
                ':t_id': {'S': tenantContext.tenant_id}
            }
        )

        list = []
        for item in resp['Items']:
            list.append({
                'productId': item['productId']['S'],
                'name': item['name']['S'],
                'description': item['description']['S'],
                'price': item['price']['S']
            })
        return {"products": list}, 200

    except ClientError as e:
        app.logger.error("ClientError: " + str(e.response['Error']['Message']))
        return {"msg": "Unable to get products!"}, 500

    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"msg": "Unable to get products!"}, 500
