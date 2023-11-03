from aws_embedded_metrics import metric_scope
import jwt
import boto3
import os
import requests
import json
from flask.logging import default_handler
from shared.log_formatter import CustomFormatter
default_handler.setFormatter(CustomFormatter())

# IMPLEMENT ME: LAB1 (TenantContext and get_tenant_context)


# IMPLEMENT ME: LAB2 (get_boto3_client)


# IMPLEMENT ME: LAB3 (get_message_detail_with_tenant_context)


# IMPLEMENT ME: LAB3 (get_tenant_context_from_message_detail)


# IMPLEMENT ME: LAB5 (create_emf_log_with_tenant_context) 


@metric_scope
def create_emf_log(service_name, metric_name, metric_value, metrics):
    metrics.set_dimensions(
        {"ServiceName": service_name},
    )
    metrics.put_metric(metric_name, metric_value)
