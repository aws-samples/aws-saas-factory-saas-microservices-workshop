import os
import json
import logging
import sys
import random
import requests
import boto3
import jwt
from shared.helper_functions import get_tenant_context
from botocore.exceptions import ClientError
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
from aws_xray_sdk.core.sampling.local.sampler import LocalSampler
from aws_embedded_metrics import metric_scope
from aws_embedded_metrics.storage_resolution import StorageResolution

logging.basicConfig(stream=sys.stdout, level=logging.INFO)

patch_all()
# table_name = os.environ["TABLE_NAME"]
xray_service_name = os.environ["AWS_XRAY_SERVICE_NAME"] + \
    "-" + os.environ["POD_NAMESPACE"]
xray_recorder.configure(
    # sampling_rules=os.path.abspath("xray_sample_rules.json"),
    service=xray_service_name,
    sampler=LocalSampler()
)
product_endpoint = os.environ["PRODUCT_ENDPOINT"]

# Initialize SQS and DynamoDB clients
sqs_client = boto3.client('sqs')

# Name of your SQS queue and DynamoDB table
sqs_queue_url = os.environ['QUEUE_URL']
# dynamodb_table_name = 'YOUR_DYNAMODB_TABLE_NAME'
max_messages_to_read = 5

# Long polling configuration
wait_time_seconds = 20


@metric_scope
def track_metric(tenant, xray_service_name, metric_name, count, metrics):
    metrics.put_dimensions({"tenant": tenant})
    metrics.put_dimensions({"ServiceName": xray_service_name})
    metrics.put_dimensions({"ServiceType": "app-service"})
    metrics.put_metric(metric_name, count, "Count", StorageResolution.STANDARD)
    metrics.flush()


# todo: determine if this should be pushed to the shared library
def log_info_message(message, tenantContext):
    message_dict = {
        'message': message,
        'tier': tenantContext.tenant_tier,
        'tenantId': tenantContext.tenant_id
    }
    logging.info(json.dumps(message_dict))


def receive_message_from_sqs(queue_url, max_messages=5):
    response = sqs_client.receive_message(
        QueueUrl=queue_url,
        AttributeNames=[
            'All'
        ],
        MessageAttributeNames=[
            'All'
        ],
        WaitTimeSeconds=wait_time_seconds,
        MaxNumberOfMessages=max_messages
    )
    return response.get('Messages', [])


def calculate_order_total(product_ids, authorization):
    total_price = 0
    for product_id in product_ids:
        url = f'http://{product_endpoint}/products/{product_id}'
        response = requests.get(
            url=url,
            headers={
                "Authorization": authorization,
            },
        )
        logging.info(f'product response: {response}')
        if response.status_code == 200:
            response_json = response.json()
            product_data = response.json().get('product', None)
            if product_data is None:
                logging.error(
                    f'lookup for product_id {product_id} failed. Response from product service: {response_json}')
                raise Exception("product data is None.")
            logging.info(f'product response: {product_data}')
            total_price += float(product_data.get('price', 0))
    return total_price


print("starting!!!")
print(__name__)
if __name__ == '__main__':
    segment = xray_recorder.begin_segment('invoice-service')
    messages = receive_message_from_sqs(
        sqs_queue_url, max_messages=max_messages_to_read)

    logging.info(f'found messages: {len(messages)}')
    logging.info(f'messages: {messages}')
    if messages:
        for message in messages:
            logging.info(f'message: {message}')
            message_body = json.loads(message['Body'])
            logging.info(f'message_body: {message_body}')

            order = json.loads(message_body.get('order', {}))
            product_ids = order.get('products', [])
            authorization = message_body.get('authorization', None)
            if not authorization:
                logging.error(f'authorization: {authorization}')
                raise Exception("Authorization in message is missing.")

            total_price = calculate_order_total(product_ids, authorization)
            tenantContext = get_tenant_context(authorization)
            segment.put_annotation('tenantId', tenantContext.tenant_id)
            segment.put_annotation('tenantTier', tenantContext.tenant_tier)
            track_metric(tenantContext.tenant_id, xray_service_name,
                         "InvoiceTotalPrice", total_price)
            sqs_client.delete_message(
                QueueUrl=sqs_queue_url, ReceiptHandle=message['ReceiptHandle'])
            log_info_message(
                f"Invoice created for order {order} with total price {total_price}", tenantContext)
    else:
        logging.info(f'No messages found in the SQS queue')

    print(f"Processed {len(messages)} messages. Exiting the script.")
    xray_recorder.end_segment()
