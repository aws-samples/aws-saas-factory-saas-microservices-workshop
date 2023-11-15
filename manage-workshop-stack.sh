#!/bin/bash -xe

run_ssm_command() {
    TARGET_USER="$1"
    C9_PID="$2"
    SSM_COMMAND="$3"
    parameters=$(jq -n --arg cm "runuser -l \"$TARGET_USER\" -c \"$SSM_COMMAND\"" '{executionTimeout:["600"], commands: [$cm]}')
    comment=$(echo "$SSM_COMMAND" | cut -c1-100)
    # send ssm command to instance id in C9_PID
    sh_command_id=$(aws ssm send-command \
        --targets "Key=InstanceIds,Values=$C9_PID" \
        --document-name "AWS-RunShellScript" \
        --parameters "$parameters" \
        --timeout-seconds 600 \
        --comment "$comment" \
        --output text \
        --query "Command.CommandId")

    command_status="InProgress" # seed status var
    while [[ "$command_status" == "InProgress" || "$command_status" == "Pending" || "$command_status" == "Delayed" ]]; do
        sleep 30
        command_invocation=$(aws ssm get-command-invocation \
            --command-id "$sh_command_id" \
            --instance-id "$C9_PID")
        echo -E "$command_invocation" | jq # for debugging purposes
        command_status=$(echo -E "$command_invocation" | jq -r '.Status')
    done

    if [ "$command_status" != "Success" ]; then
        echo "failed executing $SSM_COMMAND : $command_status" && exit 1
    else
        echo "successfully completed execution!"
    fi
}

main() {
    CLOUD9_INSTANCE_ID_PARAMETER_NAME="/workshop/cloud9InstanceId"
    GIT_REPO=$REPO_URL
    GIT_BRANCH=$REPO_BRANCH_NAME
    CDK_VERSION="2.106.1"
    npm install --force --global aws-cdk@$CDK_VERSION

    # TARGET_USER="ec2-user"
    TARGET_USER="ubuntu"
    corepack enable || echo "default to yarn v1"
    corepack prepare yarn@3.6.4 --activate || echo "default to yarn v1"

    cd standalone-eks-stack
    yarn install
    cdk bootstrap

    if [[ "$STACK_OPERATION" == "create" || "$STACK_OPERATION" == "update" ]]; then
        echo "Starting cdk deploy..."
        cdk deploy SaaSWorkshopBootstrap \
            --require-approval never
        echo "Done cdk deploy!"

        if [[ "$STACK_OPERATION" == "create" ]]; then
            # get cloud9 instance id from ssm parameter store
            C9_PID=$(aws ssm get-parameter \
                --name "$CLOUD9_INSTANCE_ID_PARAMETER_NAME" \
                --output text \
                --query "Parameter.Value")

            run_ssm_command "$TARGET_USER" "$C9_PID" "cd ~/environment ; git clone --depth 1 --branch $GIT_BRANCH $GIT_REPO || echo 'Repo already exists.'"
            run_ssm_command "$TARGET_USER" "$C9_PID" "rm -vf ~/.aws/credentials"
            run_ssm_command "$TARGET_USER" "$C9_PID" "cd ~/environment/aws-saas-factory-saas-microservices-workshop && ./setup.sh"
            run_ssm_command "$TARGET_USER" "$C9_PID" "cd ~/environment/aws-saas-factory-saas-microservices-workshop && ./deploy.sh"
            aws ec2 reboot-instances --instance-ids "$C9_PID"
        fi
    elif [ "$STACK_OPERATION" == "delete" ]; then
        C9_PID=$(aws ssm get-parameter \
            --name "$CLOUD9_INSTANCE_ID_PARAMETER_NAME" \
            --output text \
            --query "Parameter.Value" 2>/dev/null || echo "None")

        if [[ "$C9_PID" != "None" ]]; then
            run_ssm_command "$TARGET_USER" "$C9_PID" "cd ~/environment/aws-saas-factory-saas-microservices-workshop && ./destroy.sh || echo 'Not required.'"
        fi

        echo "Starting cdk destroy..."
        cdk destroy --all --force
        echo "Done cdk destroy!"
    else
        echo "Invalid stack operation!"
        exit 1
    fi
}

STACK_OPERATION=$(echo "$1" | tr '[:upper:]' '[:lower:]')

for i in {1..3}; do
    echo "iteration number: $i"
    if main "$STACK_OPERATION"; then
        break
    else
        sleep 15
    fi
done
