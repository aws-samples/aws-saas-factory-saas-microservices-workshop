from replace_function import replace_in_file, regex_replace_text

lab5_xray_annotation_original_str = r"""^( +)if tenantContext\.tenant_id is None:$
^( +)return \{"(.+)": "(.+)"\}, 400$
"""
lab5_xray_annotation_update_str = r"""\1if tenantContext.tenant_id is None:
\2return {"\3": "\4"}, 400
\1xray_recorder.put_annotation("tenant_id", tenantContext.tenant_id)
"""
for app_string in ["order", "product", "fulfillment"]:
    regex_replace_text(lab5_xray_annotation_original_str,
                       lab5_xray_annotation_update_str,
                       f"../../lib/{app_string}/app/code/app.py")
