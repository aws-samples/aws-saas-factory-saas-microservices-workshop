#!/bin/bash -xe

run_ssm_command() {
    C9_PID="$1"
    SSM_COMMAND="$2"
    parameters=$(jq -n --arg cm "runuser -l ec2-user -c \"$SSM_COMMAND\"" '{executionTimeout:["600"], commands: [$cm]}')
    status=""
    # send ssm command to instance id in C9_PID
    sh_command_id=$(aws ssm send-command \
        --targets "Key=InstanceIds,Values=$C9_PID" \
        --document-name "AWS-RunShellScript" \
        --parameters "$parameters" \
        --timeout-seconds 600 \
        --output text \
        --query "Command.CommandId")

    while [ "$status" != "Success" ] && [ "$status" != "Failed" ]; do
        sleep 30
        status=$(aws ssm list-command-invocations \
            --command-id "$sh_command_id" \
            --details \
            --output text \
            --query "CommandInvocations[0].CommandPlugins[0].Status")
    done
    [ "$status" == "Failed" ] && (echo "failed executing $SSM_COMMAND" && exit 1)
    echo "successfully completed execution!"
}

STACK_OPERATION=$(echo "$1" | tr '[:upper:]' '[:lower:]')
CLOUD9_INSTANCE_ID_PARAMETER_NAME="/saas-workshop/cloud9InstanceId"

corepack enable
corepack prepare yarn@stable --activate
cd standalone-eks-stack
yarn install
npx cdk bootstrap

if [[ "$STACK_OPERATION" == "create" || "$STACK_OPERATION" == "update" ]]; then
    echo "Starting cdk deploy..."
    npx cdk deploy SaaSWorkshopBootstrap \
        --require-approval never
    echo "Done cdk deploy!"


    if [ "$IS_WORKSHOP_STUDIO_ENV" == "yes" ]; then
        # get cloud9 instance id from ssm parameter store
        C9_PID=""
        while [ -z "$C9_PID" ]; do
            sleep 30
            C9_PID=$(aws ssm get-parameter \
                --name "$CLOUD9_INSTANCE_ID_PARAMETER_NAME" \
                --output text \
                --query "Parameter.Value")
            echo "waiting for cloud9 instance id..."
        done

        # run_ssm_command "$C9_PID" "cd ~/environment && git clone https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop"
        run_ssm_command "$C9_PID" "cd ~/environment && git clone --single-branch --branch update-eks https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop"
        run_ssm_command "$C9_PID" "cd ~/environment/aws-saas-factory-saas-microservices-workshop && ./scripts/setup-cloud9.sh"
        run_ssm_command "$C9_PID" "aws cloud9 update-environment --environment-id $C9_PID --managed-credentials-action DISABLE"
        run_ssm_command "$C9_PID" "rm -vf ${HOME}/.aws/credentials"
        run_ssm_command "$C9_PID" "cd ~/environment/aws-saas-factory-saas-microservices-workshop && ./setup.sh"
        run_ssm_command "$C9_PID" "cd ~/environment/aws-saas-factory-saas-microservices-workshop && ./deploy.sh"
        run_ssm_command "$C9_PID" "[ $(needs-restarting -r >/dev/null ) ] || exit 194"
        run_ssm_command "$C9_PID" "whoami"
    fi
elif [[ "$STACK_OPERATION" == "update" ]]; then
    echo "Starting cdk deploy..."
    npx cdk deploy SaaSWorkshopBootstrap \
        --require-approval never
    echo "Done cdk deploy!"
elif [ "$STACK_OPERATION" == "delete" ]; then
    echo "Starting cdk destroy..."
    npx cdk destroy --all --force
    echo "Done cdk destroy!"
else
    echo "Invalid stack operation!"
    exit 1
fi
