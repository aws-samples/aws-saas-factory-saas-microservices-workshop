import boto3
import os

ec2 = boto3.client('ec2')
events = boto3.client('events')
ssm = boto3.client('ssm')

instance_profile_arn = os.environ['CLOUD9_INSTANCE_PROFILE_ARN']
cloud9_rule_name = os.environ['CLOUD9_RULE_NAME']
workshop_ssm_parameter_name = os.environ['WORKSHOP_SSM_PARAMETER_NAME']


def lambda_handler(event, context):
    print(context)
    print(event)
    # get instance id from event
    instance_id = event['detail']['instance-id']

    # get tags for instance
    response = ec2.describe_instances(InstanceIds=[instance_id])
    print(response)
    instance_tags = response['Reservations'][0]['Instances'][0]['Tags']
    print(instance_tags)

    # get the tag value for the key 'WORKSHOP'
    workshop_tag = [tag['Value']
                    for tag in instance_tags if tag['Key'] == 'WORKSHOP'][0]

    if workshop_tag == 'saas-microservices':
        # add cloud9InstanceProfile to ec2 instance
        ec2.associate_iam_instance_profile(IamInstanceProfile={
            'Arn': instance_profile_arn
        })
        # create an ssm parameter containing the instance id
        ssm.put_parameter(
            Name=workshop_ssm_parameter_name,
            Value=instance_id,
            Type='String',
            Overwrite=True
        )
        # disable cloud9Rule so that it won't be run for more instances
        events.disable_rule(Name=cloud9_rule_name)
    return {
        'statusCode': 200,
        'body': 'Success!'
    }
