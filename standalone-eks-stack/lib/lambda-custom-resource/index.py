import boto3
import time

ec2_client = boto3.client('ec2')
ssm_client = boto3.client('ssm')
cloud9_client = boto3.client('cloud9')


def on_event(event, context):
    print(event)
    request_type = event['RequestType']
    if request_type == 'Create':
        return on_create(event)
    if request_type == 'Update':
        return on_update(event)
    if request_type == 'Delete':
        return on_delete(event)
    raise Exception("Invalid request type: %s" % request_type)


def on_create(event):
    props = event["ResourceProperties"]
    c9_name = props['name']
    new_instance_profile_name = props['instanceProfileName']
    instance_tag_key = props['instanceTagKey']
    instance_tag_value = props['instanceTagValue']
    ssm_instance_id_parameter_name = props['ssmInstanceIdParameterName']
    ssm_env_id_parameter_name = props['ssmEnvIdParameterName']
    cloud9_member_arn = props.get('cloud9MemberArn')

    create_environment_ec2_response = cloud9_client.create_environment_ec2(
        instanceType="m5.large",
        connectionType="CONNECT_SSM",
        imageId="amazonlinux-2-x86_64",
        description="Cloud9 Instance for SaaS Microservices Workshop.",
        name=c9_name,
        automaticStopTimeMinutes=120,
        tags=[
            {
                'Key': instance_tag_key,
                'Value': instance_tag_value
            },
        ],
        # ownerArn -> set to lambda role. This is so we can update the c9 environment
    )

    print(create_environment_ec2_response)
    cloud9_environment_id = create_environment_ec2_response['environmentId']
    ssm_client.put_parameter(
        Name=ssm_env_id_parameter_name,
        Value=cloud9_environment_id,
        Type='String',
        Overwrite=True,
    )

    if (cloud9_member_arn):
        cloud9_response = cloud9_client.create_environment_membership(
            environmentId=cloud9_environment_id,
            userArn=cloud9_member_arn,
            permissions='read-write'
        )
        print(cloud9_response)
    else:
        print("$CLOUD9_MEMBER_ARN not set. Skipping add cloud9 member.")

    while True:
        time.sleep(30)
        describe_environment_status_response = cloud9_client.describe_environment_status(
            environmentId=cloud9_environment_id
        )
        print(describe_environment_status_response)
        if describe_environment_status_response.get('status') == 'ready':
            break

    cloud9_update_env_response = cloud9_client.update_environment(
        environmentId=cloud9_environment_id,
        managedCredentialsAction='DISABLE'
    )
    print(cloud9_update_env_response)

    response = ec2_client.describe_instances(
        Filters=[
            {
                'Name': f'tag:{instance_tag_key}',
                'Values': [instance_tag_value],
            },
            {
                'Name': 'instance-state-name',
                'Values': ['running'],
            },
        ],
    )

    if 'Reservations' in response and len(response['Reservations']) > 0:
        for instance in response['Reservations'][0]['Instances']:
            instance_id = instance['InstanceId']
            print(f"updating instance: {instance_id}")
            ssm_client.put_parameter(
                Name=ssm_instance_id_parameter_name,
                Value=instance_id,
                Type='String',
                Overwrite=True,
            )
            response = ec2_client.describe_iam_instance_profile_associations(
                Filters=[
                    {
                        'Name': 'instance-id',
                                'Values': [instance_id],
                    },
                ],
            )

            if 'IamInstanceProfileAssociations' in response and len(response['IamInstanceProfileAssociations']) > 0:
                current_association_id = response['IamInstanceProfileAssociations'][0]['AssociationId']

                print(
                    f"updating instance: {instance_id} with profile: {new_instance_profile_name}")
                ec2_client.replace_iam_instance_profile_association(
                    AssociationId=current_association_id,
                    IamInstanceProfile={
                        'Name': new_instance_profile_name,
                    },
                )

                print("Rebooting the instance...")
                ec2_client.reboot_instances(InstanceIds=[instance_id])

            return {
                "PhysicalResourceId": cloud9_environment_id,
                "Data": {"status": f"successfully deployed physical_id: {cloud9_environment_id}"}
            }
        else:
            raise Exception(
                "Instance profile association not found for the instance")
    else:
        raise Exception("Instance not found with the specified tag")


def on_update(event):
    physical_id = event["PhysicalResourceId"]
    print("update resource %s" % (physical_id))
    # for updates, we delete and rebuild to avoid resource conflicts
    on_delete(event)
    return on_create(event)


def on_delete(event):
    physical_id = event["PhysicalResourceId"]
    print("delete resource %s" % physical_id)
    try:
        cloud9_client.delete_environment(
            environmentId=physical_id
        )
    except cloud9_client.exceptions.NotFoundException as e:
        print(e)
        return {"Data": {"status": f"physical_id: {physical_id} not found."}}
    return {"Data": {"status": f"successfully deleted physical_id: {physical_id}"}}
