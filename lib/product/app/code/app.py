# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import os
import logging
import random
import boto3
# from shared.helper_functions import get_tenant_context
from botocore.exceptions import ClientError
from aws_embedded_metrics.logger.metrics_logger_factory import create_metrics_logger
from flask import Flask, request
from boto3.dynamodb.conditions import Key
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
table_name = os.environ["TABLE_NAME"]
service_name = os.environ["SERVICE_NAME"]


class Product():
    product_id: str
    name: str
    description: str = None
    price: str

    def __init__(self, product_json):
        self.product_id = f"prod-{random.randint(10000, 99999)}"
        self.name = product_json["name"]
        self.description = product_json.get("description", "")
        self.price = str(float(product_json["price"]))


async def create_emf_log(service_name, metric_name, metric_value):
    logger = create_metrics_logger()
    logger.set_dimensions({"ServiceName": service_name})
    logger.put_metric(metric_name, metric_value)
    await logger.flush()


@app.route("/products/health")
def health():
    return {"message": "Status is Ok!"}


@app.route("/products/<product_id>")
def getProduct(product_id):

    # PASTE: LAB1 (GET route tenant context)

    try:
        dynamodb_resource = boto3.resource("dynamodb")
        product_table = dynamodb_resource.Table(table_name)

        # REPLACE START: LAB1 (query DynamoDB with tenant context)
        resp = product_table.query(
            KeyConditionExpression=Key("productId").eq(product_id)
        )
        # REPLACE END: LAB1 (query DynamoDB with tenant context)

        if len(resp["Items"]) < 1:
            return {"msg": "Product not found!", "product_id": product_id}, 404

        product_dict = {
            "productId": product_id,
            "name": resp["Items"][0]["name"],
            "description": resp["Items"][0]["description"],
            "price": resp["Items"][0]["price"],
        }
        return {"msg": "GET successful!", "product": product_dict}, 200

    except Exception as e:
        app.logger.error(f"Exception: {e}")
        return {"msg": "Unable to get product!", "product_id": product_id}, 500


@app.route("/products", methods=["POST"])
async def postProduct():

    # PASTE: LAB1 (post tenant context)

    try:
        product = Product(request.get_json())
    except Exception as e:
        app.logger.error(f"Exception: {e}")
        return {"message": "Error reading product!"}, 400

    try:
        dynamodb_resource = boto3.resource("dynamodb")
        product_table = dynamodb_resource.Table(table_name)

        # REPLACE START: LAB1 (DynamoDB put_item with tenant context)
        product_table.put_item(
            Item={
                "productId": product.product_id,
                "name": product.name,
                "description": product.description,
                "price": str(product.price),
            },
        )
        # REPLACE END: LAB1 (DynamoDB put_item with tenant context)

        app.logger.debug(f"Product created: {product.product_id}")
        await create_emf_log(service_name, "ProductCreated", 1)
        return {"msg": "Product created", "product": product.__dict__}, 201

    except Exception as e:
        app.logger.error(f"Exception: {e}")
        return {"msg": "Unable to create product", "product": product.__dict__}, 500

# IMPLEMENT ME: LAB1 (GET /products)
# todo: remove me after updating narrative
@app.route("/products")
def getAllProduct():
    try:
        authorization = request.headers.get("Authorization", None)
        tenant_context = get_tenant_context(authorization)
        if tenant_context.tenant_id is None:
            return {"msg": "Unable to read \"tenantId\" claim from JWT."}, 400

        dynamodb_resource = boto3.resource("dynamodb")
        product_table = dynamodb_resource.Table(table_name)

        resp = product_table.query(
            # REPLACE LINE BELOW: LAB2 (bug)
            KeyConditionExpression=Key("tenantId").eq(tenant_context.tenant_id)
        )

        product_list = []
        for item in resp["Items"]:
            product_list.append({
                "productId": item["productId"],
                "name": item["name"],
                "description": item["description"],
                "price": item["price"],
            })
        return {"products": product_list}, 200

    except ClientError as e:
        app.logger.error(f"ClientError: {str(e.response['Error']['Message'])}")
        return {"msg": "Unable to get products!"}, 500

    except Exception as e:
        app.logger.error(f"Exception: {e}")
        return {"msg": "Unable to get products!"}, 500
