import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as aws_lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

var path = require("path");
export class Cloud9Resources extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: {
      createCloud9Instance: boolean;
      workshopSSMPrefix: string;
      cloud9MemberArn?: string;
    }
  ) {
    super(scope, id);

    const createCloud9Instance = props.createCloud9Instance;
    const workshopSSMPrefix = props.workshopSSMPrefix;

    if (createCloud9Instance) {
      const cloud9TagKey = "WORKSHOP";
      const cloud9TagValue = "saas-microservices";

      if (!props.cloud9MemberArn) {
        console.error(
          "Missing parameter: 'cloud9MemberArn'. Cloud9 instance will be created without member."
        );
      }

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

      const cloud9InstanceIdSSMParameterName = `${workshopSSMPrefix}/cloud9InstanceId`;
      const cloud9InstanceEnvIdSSMParameterName = `${workshopSSMPrefix}/cloud9EnvironmentId`;
      const onEventLambdaCloud9InstanceUpdater = new aws_lambda.Function(
        this,
        "onEventLambdaCloud9InstanceUpdater",
        {
          runtime: aws_lambda.Runtime.PYTHON_3_11,
          handler: "index.on_event",
          code: aws_lambda.Code.fromAsset(
            path.join(__dirname, "lambda-custom-resource/")
          ),
          timeout: cdk.Duration.minutes(14), // 15 min is the max
          environment: {
            INSTANCE_PROFILE_NAME: cloud9InstanceProfile.instanceProfileName,
            INSTANCE_TAG_KEY: cloud9TagKey,
            INSTANCE_TAG_VALUE: cloud9TagValue,
            SSM_INSTANCE_ID_PARAMETER_NAME: cloud9InstanceIdSSMParameterName,
            SSM_ENV_ID_PARAMETER_NAME: cloud9InstanceEnvIdSSMParameterName,
            ...(props.cloud9MemberArn && {
              CLOUD9_MEMBER_ARN: props.cloud9MemberArn,
            }),
          },
          initialPolicy: [
            new iam.PolicyStatement({
              actions: [
                "ec2:ReplaceIamInstanceProfileAssociation",
                "ec2:DescribeInstances",
                "ec2:RebootInstances",
                "ec2:AssociateIamInstanceProfile",
                "ec2:ReplaceIamInstanceProfileAssociation",
              ],
              resources: [
                cdk.Stack.of(this).formatArn({
                  service: "ec2",
                  resource: "instance",
                  resourceName: "*",
                }),
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                "ec2:DescribeInstances",
                "ssm:PutParameter",
                "iam:GetRole",
                "iam:GetInstanceProfile",
                "ec2:DescribeIamInstanceProfileAssociations",
              ],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              actions: [
                "iam:CreateRole",
                "iam:AttachRolePolicy",
                "iam:CreateInstanceProfile",
                "iam:AddRoleToInstanceProfile",
                "iam:PassRole",
                "iam:ListAttachedRolePolicies",
              ],
              resources: [
                "arn:aws:iam::aws:policy/AWSCloud9SSMInstanceProfile",
                "arn:aws:iam::*:role/service-role/AWSCloud9SSMAccessRole",
                "arn:aws:iam::*:instance-profile/cloud9/AWSCloud9SSMInstanceProfile",
              ],
            }),
            new iam.PolicyStatement({
              actions: ["iam:PassRole"],
              resources: [
                cloud9Role.roleArn,
                cloud9InstanceProfile.instanceProfileArn,
              ],
            }),
          ],
        }
      );

      onEventLambdaCloud9InstanceUpdater.role?.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCloud9Administrator")
      );

      const customResourceProvider = new cr.Provider(
        this,
        "cloud9InstanceUpdater",
        {
          onEventHandler: onEventLambdaCloud9InstanceUpdater,
          logRetention: logs.RetentionDays.ONE_DAY,
        }
      );
      new cdk.CustomResource(this, "Cloud9InstanceUpdaterCustomResource", {
        serviceToken: customResourceProvider.serviceToken,
        resourceType: "Custom::cloud9InstanceUpdater",
        properties: {
          name: `workshop-instance-${this.node.addr}`,
          instanceProfileName: cloud9InstanceProfile.instanceProfileName,
          instanceTagKey: cloud9TagKey,
          instanceTagValue: cloud9TagValue,
          ssmInstanceIdParameterName: cloud9InstanceIdSSMParameterName,
          ssmEnvIdParameterName: cloud9InstanceEnvIdSSMParameterName,
          ...(props.cloud9MemberArn && {
            cloud9MemberArn: props.cloud9MemberArn,
          }),
        },
      });
    }
  }
}
