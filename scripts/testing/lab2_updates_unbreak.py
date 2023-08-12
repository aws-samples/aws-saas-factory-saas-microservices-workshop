from replace_function import replace_in_file

lab2_bug_original_str = "'S': 'tenant-a'"

lab2_bug_update_str = "'S': tenantContext.tenant_id"

replace_in_file(lab2_bug_original_str, lab2_bug_update_str,
                "../../lib/product/app/code/app.py")
