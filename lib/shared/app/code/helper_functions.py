import jwt
import boto3
import os
import requests
import json
from aws_embedded_metrics.logger.metrics_logger_factory import create_metrics_logger

# IMPLEMENT ME: LAB1 (TenantContext and get_tenant_context)


# IMPLEMENT ME: LAB2 (get_boto3_client)


# IMPLEMENT ME: LAB3 (get_message_detail_with_tenant_context)


# IMPLEMENT ME: LAB3 (get_tenant_context_from_message_detail)


# IMPLEMENT ME: LAB5 (create_emf_log_with_tenant_context)
# todo: remove lines below after updating narrative
# async def create_emf_log_with_tenant_context(service_name, tenant_context, metric_name, metric_value):
#     logger = create_metrics_logger()
#     logger.set_dimensions(
#         {"ServiceName": service_name},
#         {"ServiceName": service_name, "Tenant": tenant_context.tenant_id},
#         {"ServiceName": service_name, "Tier": tenant_context.tenant_tier},
#     )
#     logger.put_metric(metric_name, metric_value)
#     await logger.flush()
