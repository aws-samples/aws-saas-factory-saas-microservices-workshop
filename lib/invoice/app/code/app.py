import os
import json
import logging
import sys
import requests
import boto3
import asyncio
from aws_embedded_metrics.logger.metrics_logger_factory import create_metrics_logger

product_endpoint = os.environ["PRODUCT_ENDPOINT"]
service_name = os.environ["SERVICE_NAME"]
logging.basicConfig(stream=sys.stdout)
logger = logging.getLogger(service_name)
logger.setLevel(logging.INFO)

sqs_client = boto3.client('sqs')
sqs_queue_url = os.environ['QUEUE_URL']
max_messages_to_read = 10
wait_time_seconds = 20


async def create_emf_log(service_name, metric_name, metric_value):
    logger = create_metrics_logger()
    logger.set_dimensions({"ServiceName": service_name})
    logger.put_metric(metric_name, metric_value)
    await logger.flush()


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


async def main():
    while True:
        messages = receive_message_from_sqs(sqs_queue_url, max_messages=max_messages_to_read)
            
        if len(messages) < 1:            
            break

        for message in messages:
            message_body = json.loads(message['Body'])            
            message_detail = message_body.get('detail', {})
            event = message_detail.get('event', {})
            order = event.get('order', {})
            product_ids = order.get('products', [])
            
            # IMPLEMENT BELOW: LAB3 assign me to tenant context from message_detail
            tenant_context = None
            
            authorization = message_detail.get('authorization', None)
            total_price = calculate_order_total(product_ids, authorization)
            sqs_client.delete_message(QueueUrl=sqs_queue_url, ReceiptHandle=message['ReceiptHandle'])
            
            await create_emf_log(service_name, "InvoiceTotalPrice", total_price)
            message_dict = {
                'message': f"Invoice created for order {order['order_id']} with total price {total_price}",
                'tenantTier': tenant_context.tenant_tier,
                'tenantId': tenant_context.tenant_id
            }
            logger.info(json.dumps(message_dict))

if __name__ == '__main__':
    asyncio.run(main())
