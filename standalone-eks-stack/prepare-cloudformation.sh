#!/bin/bash -x

# This script is meant to prepare and package
# the output of a "cdk synth" command, so that
# it can be deployed with CloudFormation. It currently
# is meant to work with the stack called "eksBlueprintStackEKSStack".
#
# Please have the "cdk.out" folder prepared and accessible via "cd cdk.out/" from this script.
#
# To use, run the following:
# $ bash prepare-cloudformation.sh "us-west-2"
#

CDK_STACK_NAME="eksBlueprintStackEKSStack"
MAIN_TEMPLATE_NAME="EKSStack.json"
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

AWS_DEFAULT_REGION="$1"
if [ -z "$AWS_DEFAULT_REGION" ]; then
    echo "AWS_DEFAULT_REGION value not set. Please configure AWS_DEFAULT_REGION by running this script with AWS_DEFAULT_REGION passed in as an argument."
    exit 1
fi

ASSETS_FOLDER_NAME="assets-${RANDOM}${RANDOM}-${ACCOUNT_ID}-${AWS_DEFAULT_REGION}-DO-NOT-COMMIT-PLEASE"
mkdir "$ASSETS_FOLDER_NAME"

cd cdk.out/ || exit 1
template_file_name=$(find . -name "${CDK_STACK_NAME}*.template.json" | grep -v "nested" | cut -d/ -f2)
assets_file_name=$(find . -name "${CDK_STACK_NAME}*.assets.json" | cut -d/ -f2)

# process all of the assets in the assets file:
# this involves copying over assets to a temporary assets folder ($ASSETS_FOLDER_NAME)
# or zipping up folders and then copying that over.
for i in $(jq -r '.files | keys[]' "$assets_file_name"); do
    packaging=$(jq -r ".files.\"$i\".source.packaging" "$assets_file_name")
    path=$(jq -r ".files.\"$i\".source.path" "$assets_file_name")
    objectKey=$(jq -r ".files.\"$i\".destinations.\"${ACCOUNT_ID}-${AWS_DEFAULT_REGION}\".objectKey" "$assets_file_name")
    if [[ "$packaging" == "file" ]]; then
        cp "$path" "../${ASSETS_FOLDER_NAME}/${objectKey}"
    elif [[ "$packaging" == "zip" ]]; then
        cd "${path}" || exit 1
        zip -r ../"${objectKey}" .
        cd ..
        cp "${objectKey}" "../${ASSETS_FOLDER_NAME}/${objectKey}"
    else
        echo "unrecognized packaging: \"${packaging}\""
    fi

    if [[ "$path" == "$template_file_name" ]]; then
        mv "../${ASSETS_FOLDER_NAME}/${objectKey}" "../${ASSETS_FOLDER_NAME}/${MAIN_TEMPLATE_NAME}"
    fi
done
cd ..

echo "MAIN_TEMPLATE_NAME $MAIN_TEMPLATE_NAME"
echo "ASSETS_FOLDER_NAME $ASSETS_FOLDER_NAME"
