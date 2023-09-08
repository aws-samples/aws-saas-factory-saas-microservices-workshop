import * as ssm from "aws-cdk-lib/aws-ssm";
import * as events from "aws-cdk-lib/aws-events";
import * as events_targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { aws_cloud9 as cloud9 } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as blueprints from "@aws-quickstart/eks-blueprints";

export class ExtensionStack extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: {
      clusterInfo: blueprints.ClusterInfo;
      createCloud9Instance: boolean;
      workshopSSMPrefix: string;
      cloud9OwnerArn?: string;
    }
  ) {
    super(scope, id);

    const clusterInfo = props.clusterInfo;
    const createCloud9Instance = props.createCloud9Instance;
    const workshopSSMPrefix = props.workshopSSMPrefix;
    const cloud9OwnerArn = props.cloud9OwnerArn;

    if (createCloud9Instance) {
      if (!cloud9OwnerArn) {
        console.error(
          "Missing parameter: 'cloud9OwnerArn'. Cloud9 instance will be created without ownerArn."
        );
      }

      new cloud9.CfnEnvironmentEC2(this, "MyCfnEnvironmentEC2", {
        instanceType: "m5.large",
        connectionType: "CONNECT_SSH",
        imageId: "amazonlinux-2-x86_64",
        description: "Cloud9 Instance for SaaS Microservices Workshop.",
        name: "Workshop-Instance",
        ownerArn: cloud9OwnerArn,
        tags: [
          {
            key: "WORKSHOP",
            value: "saas-microservices",
          },
        ],
      });

      const cloud9Role = new iam.Role(this, "Cloud9Role", {
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"),
        ],
      });

      const cloud9InstanceProfile = new iam.InstanceProfile(
        this,
        "Cloud9InstanceProfile",
        {
          role: cloud9Role,
        }
      );

      const cloud9Rule = new events.Rule(this, "Cloud9Rule", {
        enabled: true,
        eventPattern: {
          source: ["aws.ec2"],
          detailType: ["EC2 Instance State-change Notification"],
          detail: {
            state: ["running"],
          },
        },
      });

      const cloud9RuleLambda = new lambda.Function(this, "cloud9RuleLambda", {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: "index.handler",
        environment: {
          CLOUD9_INSTANCE_PROFILE_ARN: cloud9InstanceProfile.instanceProfileArn,
          CLOUD9_RULE_NAME: cloud9Rule.ruleName,
        },
        code: lambda.Code.fromInline(
          `
import boto3
import os
instance_profile_arn = os.environ['CLOUD9_INSTANCE_PROFILE_ARN']
ec2 = boto3.client('ec2')
events = boto3.client('events')
cloud9_rule_name = os.environ['CLOUD9_RULE'])

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
    workshop_tag = [tag['Value'] for tag in instance_tags if tag['Key'] == 'WORKSHOP'][0]
    if workshop_tag == 'saas-microservices':
        # add cloud9InstanceProfile to ec2 instance
        ec2.associate_iam_instance_profile(IamInstanceProfile={
            'Arn': instance_profile_arn
        }
        # disable cloud9Rule so that it won't be run for more instances
        cloud9Rule.disable_rule(Name=cloud9_rule_name)
    return {
        'statusCode': 200,
        'body': 'Success!'
    }
`
        ),
      });

      cloud9Rule.addTarget(new events_targets.LambdaFunction(cloud9RuleLambda));

      new ssm.StringParameter(this, "cloud9InstanceProfileName", {
        parameterName: `${workshopSSMPrefix}/cloud9InstanceProfileName`,
        stringValue: cloud9InstanceProfile.instanceProfileName,
      });
    }

    new ssm.StringParameter(this, "clusterNameParameter", {
      parameterName: `${workshopSSMPrefix}/clusterName`,
      stringValue: clusterInfo.cluster.clusterName,
    });

    new ssm.StringParameter(this, "kubectlRoleArnParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlRoleArn`,
      stringValue: clusterInfo.cluster.kubectlRole?.roleArn || "EMPTY",
    });

    new ssm.StringParameter(this, "kubectlSecurityGroupIdParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlSecurityGroupId`,
      stringValue:
        clusterInfo.cluster.kubectlSecurityGroup?.securityGroupId || "EMPTY",
    });

    new ssm.StringParameter(this, "clusterSecurityGroupIdParameter", {
      parameterName: `${workshopSSMPrefix}/clusterSecurityGroupId`,
      stringValue: clusterInfo.cluster.clusterSecurityGroupId,
    });

    new ssm.StringParameter(this, "kubectlLambdaRoleArnParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlLambdaRoleArnParameter`,
      stringValue: clusterInfo.cluster.kubectlLambdaRole?.roleArn || "EMPTY",
    });

    new ssm.StringParameter(this, "kubectlLayerVersionArn", {
      parameterName: `${workshopSSMPrefix}/kubectlLayerVersionArn`,
      stringValue: clusterInfo.cluster.kubectlLayer?.layerVersionArn || "EMPTY",
    });

    new ssm.StringParameter(this, "awscliLayerVersionArn", {
      parameterName: `${workshopSSMPrefix}/awscliLayerVersionArn`,
      stringValue: clusterInfo.cluster.awscliLayer?.layerVersionArn || "EMPTY",
    });

    new ssm.StringParameter(this, "vpcIdParameter", {
      parameterName: `${workshopSSMPrefix}/vpcIdParameter`,
      stringValue: clusterInfo.cluster.vpc.vpcId,
    });

    new ssm.StringParameter(this, "openIdConnectProviderArnParameter", {
      parameterName: `${workshopSSMPrefix}/openIdConnectProviderArn`,
      stringValue:
        clusterInfo.cluster.openIdConnectProvider.openIdConnectProviderArn,
    });
  }
}
