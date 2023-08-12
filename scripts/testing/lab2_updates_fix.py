from replace_function import replace_in_file

lab2_service_account_original_str = """    productServiceAccount.role.attachInlinePolicy(
      new iam.Policy(this, "ProductServicePolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["dynamodb:query", "dynamodb:PutItem"],
            resources: [productTable.tableArn],
          }),
        ],
      })
    );
"""

lab2_service_account_update_str = """    const accessRole = new iam.Role(this, "access-role", {
      assumedBy: productServiceAccount.role.grantPrincipal,
    });    
    accessRole.assumeRolePolicy?.addStatements(
        new iam.PolicyStatement({
            principals: [productServiceAccount.role.grantPrincipal],
            actions: ["sts:TagSession"],
            conditions: {
                StringLike: {[`aws:RequestTag/TenantID`]: "*"},
            },
        })
    );
    accessRole.attachInlinePolicy(
        new iam.Policy(this, "ProductServiceAccessPolicy", {
            statements: [
                new iam.PolicyStatement({
                    actions: ["dynamodb:query", "dynamodb:PutItem"],
                    resources: [productTable.tableArn],
                    conditions: {
                        "ForAllValues:StringLike": {
                        "dynamodb:LeadingKeys": [`\${aws:PrincipalTag/TenantID}`],
                        },
                    },
                }),
            ],
        })
    );
"""

replace_in_file(lab2_service_account_original_str, lab2_service_account_update_str,
                "../../lib/product/infrastructure/product-stack.ts")

lab2_sidecar_first_comment_original_str = "/* // REMOVE THIS LINE: LAB2 (sidecar app)"
lab2_sidecar_first_comment_update_str = ""
replace_in_file(lab2_sidecar_first_comment_original_str, lab2_sidecar_first_comment_update_str,
                "../../lib/product/infrastructure/product-stack.ts")

lab2_sidecar_second_comment_original_str = "*/ // REMOVE THIS LINE: LAB2 (sidecar app)"
lab2_sidecar_second_comment_update_str = ""
replace_in_file(lab2_sidecar_second_comment_original_str, lab2_sidecar_second_comment_update_str,
                "../../lib/product/infrastructure/product-stack.ts")

lab2_annotation_first_comment_original_str = "/* // REMOVE THIS LINE: LAB2 (annotation)"
lab2_annotation_first_comment_update_str = ""
replace_in_file(lab2_annotation_first_comment_original_str, lab2_annotation_first_comment_update_str,
                "../../lib/product/infrastructure/product-stack.ts")

lab2_annotation_second_comment_original_str = "*/ // REMOVE THIS LINE: LAB2 (annotation)"
lab2_annotation_second_comment_update_str = ""
replace_in_file(lab2_annotation_second_comment_original_str, lab2_annotation_second_comment_update_str,
                "../../lib/product/infrastructure/product-stack.ts")

lab2_boto3_client_original_str = """def get_boto3_client(service):
    return boto3.client(service)
"""
lab2_boto3_client_update_str = """def get_boto3_client(service, authorization):
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
replace_in_file(lab2_boto3_client_original_str, lab2_boto3_client_update_str,
                "../../lib/product/app/code/app.py")

lab2_ddb_client_original_str = 'dynamodb_client = get_boto3_client("dynamodb")'
lab2_ddb_client_update_str = 'dynamodb_client = get_boto3_client("dynamodb", authorization)'
replace_in_file(lab2_ddb_client_original_str, lab2_ddb_client_update_str,
                "../../lib/product/app/code/app.py")
