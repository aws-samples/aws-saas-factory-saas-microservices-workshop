from replace_function import replace_in_file

lab1_namespace_original_str = """    // REPLACE START: LAB1 (namespace)
    const namespace = "default";
    const multiTenantLabels = {};
    // REPLACE END: LAB1 (namespace)
"""

lab1_namespace_update_str = """    const tier = props.tier;
    const tenantId = props.tenantId;
    const namespace = props.namespace // from the ApplicationStack
    const multiTenantLabels = {
        tier: tier,
        ...(tenantId && {tenantId: tenantId})
    }
"""

replace_in_file(lab1_namespace_original_str, lab1_namespace_update_str,
                "../../lib/product/infrastructure/product-stack.ts")

lab1_product_table_original_str = """
    const productTable = new dynamodb.Table(this, "ProductTable", {
      partitionKey: { name: "productId", type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
      billingMode: dynamodb.BillingMode.PROVISIONED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: `SaaSMicroservices-Products`,
    });
"""

lab1_product_table_update_str = """
    const productTable = new dynamodb.Table(this, "ProductTable", {
      partitionKey: { name: "tenantId", type: dynamodb.AttributeType.STRING }, // tenant-id partition key
      sortKey: { name: "productId", type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
      billingMode: dynamodb.BillingMode.PROVISIONED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: `SaaSMicroservices-Products-${namespace}`, // namespace appended to the table name  
    });
"""

replace_in_file(lab1_product_table_original_str, lab1_product_table_update_str,
                "../../lib/product/infrastructure/product-stack.ts")

lab1_tenant_context_original_str = """# PASTE: LAB1(tenant context)"""

lab1_tenant_context_update_str = """
class TenantContext:
    tenant_id: str = None
    tenant_tier: str = None

    def __init__(self, jwt):
        self.tenant_id = jwt.get('custom:tenant_id', None)
        self.tenant_tier = jwt.get('custom:tenant_tier', None)

def get_tenant_context(authorization):
    token = authorization.replace("Bearer ", "")
    decoded_token = jwt.decode(token, options={"verify_signature": False})
    return TenantContext(decoded_token)
"""

replace_in_file(lab1_tenant_context_original_str, lab1_tenant_context_update_str,
                "../../lib/product/app/code/app.py")

lab1_get_tenant_context_original_str = """    # PASTE: LAB1 (GET route tenant context)"""
lab1_get_tenant_context_update_str = """    # PASTE: LAB1 (GET route tenant context)
    authorization = request.headers.get("Authorization", None) #Read the HTTP Authorization header
    tenantContext = get_tenant_context(authorization)          #Get tenant context from token
    if tenantContext.tenant_id is None:
        return {"msg": "Invalid 'tenantId' claim."}, 400
"""

replace_in_file(lab1_get_tenant_context_original_str, lab1_get_tenant_context_update_str,
                "../../lib/product/app/code/app.py")

lab1_ddb_query_original_str = """        # REPLACE START: LAB1 (query DynamoDB with tenant context)
        resp = dynamodb_client.query(
            TableName=table_name,
            KeyConditionExpression='productId=:p_id',
            ExpressionAttributeValues={':p_id': {'S': product_id}}
        )
        # REPLACE END: LAB1 (query DynamoDB with tenant context)
"""

lab1_ddb_query_update_str = """        # REPLACE START: LAB1 (DynamoDB query with tenant context)
        resp = dynamodb_client.query(
            TableName=table_name,
            KeyConditionExpression='tenantId=:t_id AND productId=:p_id', # query by tenant-id and product-id 
            ExpressionAttributeValues={
                ':t_id': {'S': tenantContext.tenant_id},                 # setting tenant-id from context
                ':p_id': {'S': product_id}
            }
        )
        # REPLACE END: LAB1 (DynamoDB query with tenant context)
"""

replace_in_file(lab1_ddb_query_original_str, lab1_ddb_query_update_str,
                "../../lib/product/app/code/app.py")

lab1_post_tenant_context_original_str = """    # PASTE: LAB1 (post tenant context)"""
lab1_post_tenant_context_update_str = """    # PASTE: LAB1 (post tenant context)
    authorization = request.headers.get("Authorization", None) #Read the HTTP Authorization header
    tenantContext = get_tenant_context(authorization)          #Get tenant context from token
    if tenantContext.tenant_id is None:
        return {"msg": "Invalid 'tenantId' claim."}, 400
"""
replace_in_file(lab1_post_tenant_context_original_str,
                lab1_post_tenant_context_update_str, "../../lib/product/app/code/app.py")

lab1_put_item_original_str = """        # REPLACE START: LAB1 (DynamoDB put_item with tenant context)
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
"""

lab1_put_item_update_str = """        # REPLACE START: LAB1 (DynamoDB put_item with tenant context)
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
"""
replace_in_file(lab1_put_item_original_str,
                lab1_put_item_update_str, "../../lib/product/app/code/app.py")

lab1_get_products_original_str = """    # IMPLEMENT ME: LAB1 (GET /products)
    pass
"""

lab1_get_products_update_str = """    # IMPLEMENT ME: LAB1 (GET /products)
    try:
        authorization = request.headers.get("Authorization", None)
        tenantContext = get_tenant_context(authorization)
        if tenantContext.tenant_id is None:
            return {"msg": "Unable to read 'tenantId' claim from JWT."}, 400
        
        dynamodb_client = get_boto3_client("dynamodb")

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
"""
replace_in_file(lab1_get_products_original_str,
                lab1_get_products_update_str, "../../lib/product/app/code/app.py")
