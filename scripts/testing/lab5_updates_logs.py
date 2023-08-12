from replace_function import replace_in_file, regex_replace_text

lab5_import_original_str = r"""^from shared.helper_functions import get_tenant_context, get_boto3_client$"""
lab5_import_update_str = 'from shared.helper_functions import get_tenant_context, get_boto3_client, log_info_message'
regex_replace_text(lab5_import_original_str,
                   lab5_import_update_str,
                   "../../lib/order/app/code/app.py")

lab5_log_original_str = """        # REPLACE BELOW: LAB5 (log)
        app.logger.debug("Order created: " + str(order.order_id) +
                         ", tenant:" + str(tenantContext.tenant_id))
"""

lab5_log_update_str = """        # REPLACE BELOW: LAB5 (log)
        log_info_message(app, "Order created", tenantContext)
"""
replace_in_file(lab5_log_original_str,
                lab5_log_update_str,
                "../../lib/order/app/code/app.py")
