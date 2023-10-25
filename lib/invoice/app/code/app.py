import os
import json
import logging
import sys
import requests
import boto3
import jwt
from shared.helper_functions import get_tenant_context, track_metric
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
from aws_xray_sdk.core.sampling.local.sampler import LocalSampler

patch_all()
product_endpoint = os.environ["PRODUCT_ENDPOINT"]
service_name = os.environ["SERVICE_NAME"]
service_type = os.environ["SERVICE_TYPE"]
logging.basicConfig(stream=sys.stdout)
logger = logging.getLogger(service_name)
logger.setLevel(logging.INFO)

xray_recorder.configure(
    service=service_name,
    sampler=LocalSampler(),
)

sqs_client = boto3.client('sqs')
sqs_queue_url = os.environ['QUEUE_URL']
max_messages_to_read = 10
wait_time_seconds = 20


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
        logger.info(f'product response: {response}')
        if response.status_code == 200:
            response_json = response.json()
            product_data = response.json().get('product', None)
            if product_data is None:
                logger.error(
                    f'lookup for product_id {product_id} failed. Response from product service: {response_json}')
                raise Exception("product data is None.")
            logger.info(f'product response: {product_data}')
            total_price += float(product_data.get('price', 0))
    return total_price


if __name__ == '__main__':
    logger.info(f'searching for sqs messages...')
    messages_processed = 0
    while True:
        segment = xray_recorder.begin_segment(service_name)
        messages = receive_message_from_sqs(
            sqs_queue_url, max_messages=max_messages_to_read)

        logger.info(f'found {len(messages)} messages')
        logger.info(f'messages: {messages}')
        if messages:
            for message in messages:
                logger.info(f'message: {message}')
                message_body = json.loads(message['Body'])
                logger.info(f'message_body: {message_body}')

                message_detail = message_body.get('detail', {})
                logger.info(f'message_detail: {message_detail}')
                order = message_detail.get('order', {})
                product_ids = order.get('products', [])
                authorization = message_detail.get('authorization', None)
                if not authorization:
                    logger.error(f'authorization: {authorization}')
                    raise Exception("Authorization in message is missing.")

                tenantContext = get_tenant_context(authorization)
                subsegment = xray_recorder.begin_subsegment(
                    f'{service_name}-fulfillment-processing', 'remote')
                subsegment.put_annotation('tenant_id', tenantContext.tenant_id)
                subsegment.put_annotation(
                    'tenant_tier', tenantContext.tenant_tier)

                total_price = calculate_order_total(product_ids, authorization)
                track_metric(authorization, service_name, service_type,
                             "InvoiceTotalPrice", total_price)
                xray_recorder.end_subsegment()

                sqs_client.delete_message(
                    QueueUrl=sqs_queue_url, ReceiptHandle=message['ReceiptHandle'])

                message_dict = {
                    'message': f"Invoice created for order {order} with total price {total_price}",
                    'tenantTier': tenantContext.tenant_tier,
                    'tenantId': tenantContext.tenant_id
                }
                logger.info(json.dumps(message_dict))
                messages_processed += 1
        else:
            logger.info(f'No messages found in the SQS queue')
            break
        xray_recorder.end_segment()

    logger.info(
        f"Processed {messages_processed} messages. Exiting the script.")