import os
import logging
import random
import boto3
# from shared.helper_functions import get_tenant_context
from botocore.exceptions import ClientError
from aws_embedded_metrics.logger.metrics_logger_factory import create_metrics_logger
from flask import Flask, request
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
        self.product_id = "prod-" + str(random.randint(10000, 99999))
        self.name = product_json['name']
        self.description = product_json.get('description', '')
        self.price = str(float(product_json['price']))


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
        dynamodb_client = boto3.client("dynamodb")

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
async def postProduct():

    # PASTE: LAB1 (post tenant context)

    try:
        product = Product(request.get_json())
    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"message": "Error reading product!"}, 400

    try:
        dynamodb_client = boto3.client("dynamodb")

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
        await create_emf_log(service_name, "ProductCreated", 1)
        # await create_emf_log_with_tenant_context(service_name, tenant_context, "ProductCreated", 1) # todo: remove me after updating narrative
        return {"msg": "Product created", "product": product.__dict__}, 201

    except Exception as e:
        app.logger.error("Exception: " + str(e))
        return {"msg": "Unable to create product", "product": product.__dict__}, 500

# IMPLEMENT ME: LAB1 (GET /products)
