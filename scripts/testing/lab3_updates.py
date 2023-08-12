from replace_function import replace_in_file
replace_in_file("# from shared.helper_functions import get_tenant_context, get_boto3_client",
                "from shared.helper_functions import get_tenant_context, get_boto3_client",
                "../../lib/order/app/code/app.py")
replace_in_file("# from shared.helper_functions import get_tenant_context, get_boto3_client",
                "from shared.helper_functions import get_tenant_context, get_boto3_client",
                "../../lib/product/app/code/app.py")

replace_in_file("# from shared.helper_functions import get_tenant_context",
                "from shared.helper_functions import get_tenant_context",
                "../../lib/fulfillment/app/code/app.py")

lab3_tenant_context_original_str = """class TenantContext:
    tenant_id: str = None
    tenant_tier: str = None

    def __init__(self, jwt):
        self.tenant_id = jwt.get('custom:tenant_id', None)
        self.tenant_tier = jwt.get('custom:tenant_tier', None)
"""
lab3_tenant_context_update_str = ""
for app_string in ["order", "product", "fulfillment"]:
    replace_in_file(lab3_tenant_context_original_str,
                    lab3_tenant_context_update_str,
                    f"../../lib/{app_string}/app/code/app.py")

lab3_get_tenant_context_original_str = """def get_tenant_context(authorization):
    token = authorization.replace("Bearer ", "")
    decoded_token = jwt.decode(token, options={"verify_signature": False})
    return TenantContext(decoded_token)
"""
lab3_get_tenant_context_update_str = ""
for app_string in ["order", "product", "fulfillment"]:
    replace_in_file(lab3_get_tenant_context_original_str,
                    lab3_get_tenant_context_update_str,
                    f"../../lib/{app_string}/app/code/app.py")

lab3_get_boto3_client_original_str = """def get_boto3_client(service, authorization):
    token_vendor_endpoint = "127.0.0.1"
    token_vendor_endpoint_port = os.environ["TOKEN_VENDOR_ENDPOINT_PORT"]
    url = "http://" + token_vendor_endpoint + ":" + token_vendor_endpoint_port
    print("Token Vendor URL: " + url)
    response = requests.get(
        url,
        headers={
            "Authorization": authorization
        }
    ).json()

    access_key = response["Credentials"]["AccessKeyId"]
    secret_key = response["Credentials"]["SecretAccessKey"]
    session_token = response["Credentials"]["SessionToken"]

    return boto3.client(
        service,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        aws_session_token=session_token
    )
"""
lab3_get_boto3_client_update_str = ""
for app_string in ["order", "product"]:
    replace_in_file(lab3_get_boto3_client_original_str,
                    lab3_get_boto3_client_update_str,
                    f"../../lib/{app_string}/app/code/app.py")

lab3_dockerfile_original_str = r"""# WORKDIR $APP_SHARED_DIR

# # switch back to root user temporarily to grab and unzip shared lib files.
# USER root
# ENV COMMIT_ID="e0b2979bff525be25ac7f9a11f0066cf078fbb24"
# ADD https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop/archive/${COMMIT_ID}.zip ${COMMIT_ID}.zip

# RUN unzip ${COMMIT_ID}.zip \
#     && mv aws-saas-factory-saas-microservices-workshop-${COMMIT_ID}/lib/shared/* . \
#     && rm -rf ${COMMIT_ID}.zip aws-saas-factory-saas-microservices-workshop-${COMMIT_ID}
# USER $APP_USER

# RUN pip install --user --no-cache-dir --requirement $APP_SHARED_DIR/requirements.txt
"""

lab3_dockerfile_update_str = r"""WORKDIR $APP_SHARED_DIR

# switch back to root user temporarily to grab and unzip shared lib files.
USER root
ENV COMMIT_ID="e0b2979bff525be25ac7f9a11f0066cf078fbb24"
ADD https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop/archive/${COMMIT_ID}.zip ${COMMIT_ID}.zip

RUN unzip ${COMMIT_ID}.zip \
    && mv aws-saas-factory-saas-microservices-workshop-${COMMIT_ID}/lib/shared/* . \
    && rm -rf ${COMMIT_ID}.zip aws-saas-factory-saas-microservices-workshop-${COMMIT_ID}
USER $APP_USER

RUN pip install --user --no-cache-dir --requirement $APP_SHARED_DIR/requirements.txt
"""

for app_string in ["order", "product", "fulfillment"]:
    replace_in_file(lab3_dockerfile_original_str,
                    lab3_dockerfile_update_str,
                    f"../../lib/{app_string}/app/Dockerfile")
