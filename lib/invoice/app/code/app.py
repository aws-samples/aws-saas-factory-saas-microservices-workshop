import os
import json
import logging
import sys
import requests
import boto3
import jwt
from shared.helper_functions import create_emf_log

product_endpoint = os.environ["PRODUCT_ENDPOINT"]
service_name = os.environ["SERVICE_NAME"]
logging.basicConfig(stream=sys.stdout)
logger = logging.getLogger(service_name)
logger.setLevel(logging.INFO)

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
        if response.status_code == 200:
            response_json = response.json()
            product_data = response.json().get('product', None)
            if product_data is None:
                logger.error(f'lookup for product_id {product_id} failed. Response from product service: {response_json}')
                raise Exception("product data is None.")
            total_price += float(product_data.get('price', 0))
    return total_price


if __name__ == '__main__':
    while True:
        messages = receive_message_from_sqs(sqs_queue_url, max_messages=max_messages_to_read)
            
        if len(messages) < 1:
            logger.info(f'No more messages found in the SQS queue. Exiting.')
            break

        for message in messages:
            message_body = json.loads(message['Body'])            
            message_detail = message_body.get('detail', {})
            event = message_detail.get('message', {})
            order = event.get('order', {})
            product_ids = order.get('products', [])
            
            # IMPLEMENT BELOW: LAB3 assign me to tenant context from message_detail
            tenant_context = None
            
            authorization = message_detail.get('authorization', None)
            total_price = calculate_order_total(product_ids, authorization)
            sqs_client.delete_message(QueueUrl=sqs_queue_url, ReceiptHandle=message['ReceiptHandle'])
            
            create_emf_log(service_name, "InvoiceTotalPrice", total_price)
            message_dict = {
                'message': f"Invoice created for order {order['order_id']} with total price {total_price}",
                'tenantTier': tenant_context.tenant_tier,
                'tenantId': tenant_context.tenant_id
            }
            logger.info(json.dumps(message_dict))
