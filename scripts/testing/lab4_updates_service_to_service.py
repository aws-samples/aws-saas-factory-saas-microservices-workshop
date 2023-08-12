from replace_function import replace_in_file

lab4_routing_rule_first_comment_original_str = "/* // LAB4: REMOVE THIS LINE (routing)"
lab4_routing_rule_first_comment_update_str = ""
for app_string in ["fulfillment"]:
    replace_in_file(lab4_routing_rule_first_comment_original_str,
                    lab4_routing_rule_first_comment_update_str,
                    f"../../lib/{app_string}/infrastructure/{app_string}-stack.ts")


lab4_routing_rule_second_comment_original_str = "*/ // LAB4: REMOVE THIS LINE (routing)"
lab4_routing_rule_second_comment_update_str = ""
for app_string in ["fulfillment"]:
    replace_in_file(lab4_routing_rule_second_comment_original_str,
                    lab4_routing_rule_second_comment_update_str,
                    f"../../lib/{app_string}/infrastructure/{app_string}-stack.ts")

lab4_submit_fulf_original_str = "# PASTE LINES BELOW: LAB4 (routing)"
lab4_submit_fulf_update_str = '"x-app-tenant-id": tenantContext.tenant_id, "x-app-tier": tenantContext.tenant_tier,'
replace_in_file(lab4_submit_fulf_original_str,
                lab4_submit_fulf_update_str,
                "../../lib/order/app/code/app.py")
