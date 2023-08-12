import re


def regex_replace_text(str_to_find, replacement_str, file_name):
    with open(file_name, 'r') as f:
        file_contents = f.read()

    file_contents, substitutions = re.subn(
        str_to_find, replacement_str, file_contents, flags=re.MULTILINE)

    if substitutions < 1:
        print(f"no substitutions made in {file_name}!")

    with open(file_name, 'w') as f:
        f.write(file_contents)


def replace_in_file(str_to_find, replacement_str, file_name):
    with open(file_name, 'r') as f:
        file_contents = f.read()

    if str_to_find not in file_contents:
        print(str_to_find)
        print(f"string not found in file: {file_name}")
        return

    file_contents = file_contents.replace(str_to_find, replacement_str)
    with open(file_name, 'w') as f:
        f.write(file_contents)
