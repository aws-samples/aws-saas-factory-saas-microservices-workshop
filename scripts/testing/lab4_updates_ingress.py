from replace_function import replace_in_file

lab4_routing_rule_first_comment_original_str = "/* // LAB4: REMOVE THIS LINE (routing)"
lab4_routing_rule_first_comment_update_str = ""
for app_string in ["order", "product"]:
    replace_in_file(lab4_routing_rule_first_comment_original_str,
                    lab4_routing_rule_first_comment_update_str,
                    f"../../lib/{app_string}/infrastructure/{app_string}-stack.ts")


lab4_routing_rule_second_comment_original_str = "*/ // LAB4: REMOVE THIS LINE (routing)"
lab4_routing_rule_second_comment_update_str = ""
for app_string in ["order", "product"]:
    replace_in_file(lab4_routing_rule_second_comment_original_str,
                    lab4_routing_rule_second_comment_update_str,
                    f"../../lib/{app_string}/infrastructure/{app_string}-stack.ts")
