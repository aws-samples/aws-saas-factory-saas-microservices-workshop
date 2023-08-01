import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import { ILogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as blueprints from "@aws-quickstart/eks-blueprints";
import {
  ResourceProvider,
  ResourceContext,
  ClusterInfo,
} from "@aws-quickstart/eks-blueprints";
import { CapacityType, KubernetesVersion } from "aws-cdk-lib/aws-eks";

class LogGroupResourceProvider implements ResourceProvider<ILogGroup> {
  provide(context: ResourceContext): ILogGroup {
    const scope = context.scope;
    return new logs.LogGroup(scope, "fluent-bit-log-group", {
      logGroupName: "/saas-workshop/eks/fluent-bit/container-logs",
      retention: 7,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}

class MyCustomAwsForFluentBitAddOn implements blueprints.ClusterAddOn {
  deploy(clusterInfo: ClusterInfo): void | Promise<Construct> {
    const logGroup: ILogGroup = clusterInfo.getRequiredResource("LogGroup");
    const addon = new blueprints.addons.AwsForFluentBitAddOn({
      version: "0.1.21",
      iamPolicies: [
        new iam.PolicyStatement({
          actions: ["logs:*"],
          resources: [
            `${logGroup.logGroupArn}:*`,
            `${logGroup.logGroupArn}:*:*`,
          ],
        }),
      ],
      values: {
        cloudWatch: {
          enabled: true,
          region: cdk.Stack.of(clusterInfo.cluster).region,
          logGroupName: logGroup.logGroupName,
        },
        firehose: {
          enabled: false,
        },
        kinesis: {
          enabled: false,
        },
        elasticsearch: {
          enabled: false,
        },
      },
    });
    return addon.deploy(clusterInfo);
  }
}

export class extensionStack extends cdk.NestedStack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.NestedStackProps,
    clusterInfo: blueprints.ClusterInfo,
    createCloud9InstanceParameter: cdk.CfnParameter
  ) {
    super(scope, id, props);

    const cloud9 = new cdk.CfnResource(this, "cloud9", {
      type: "AWS::Cloud9::EnvironmentEC2",
      properties: {
        Name: "Workshop-Instance",
        Description: "Cloud9 Instance for SaaS Microservices Workshop.",
        InstanceType: "m5.large",
        ConnectionType: "CONNECT_SSH",
        ImageId: "amazonlinux-2-x86_64",
      },
    });

    cloud9.cfnOptions.condition = new cdk.CfnCondition(
      this,
      "cloud9Condition",
      {
        expression: cdk.Fn.conditionEquals(
          createCloud9InstanceParameter.valueAsString,
          "true"
        ),
      }
    );

    new ssm.StringParameter(this, "clusterNameParameter", {
      parameterName: "/saas-workshop/clusterName",
      stringValue: clusterInfo.cluster.clusterName,
    });

    new ssm.StringParameter(this, "kubectlRoleArnParameter", {
      parameterName: "/saas-workshop/kubectlRoleArn",
      stringValue: clusterInfo.cluster.kubectlRole?.roleArn || "N/A",
    });

    new ssm.StringParameter(this, "kubectlLayerVersionArnParameter", {
      parameterName: "/saas-workshop/kubectlLayerVersionArn",
      stringValue: clusterInfo.cluster.kubectlLayer?.layerVersionArn || "N/A",
    });

    new ssm.StringParameter(this, "awscliLayerVersionArnParameter", {
      parameterName: "/saas-workshop/awscliLayerVersionArn",
      stringValue: clusterInfo.cluster.awscliLayer?.layerVersionArn || "N/A",
    });

    new ssm.StringParameter(this, "kubectlSecurityGroupIdParameter", {
      parameterName: "/saas-workshop/kubectlSecurityGroupId",
      stringValue:
        clusterInfo.cluster.kubectlSecurityGroup?.securityGroupId || "N/A",
    });

    new ssm.StringParameter(this, "kubectlPrivateSubnetIdsParameter", {
      parameterName: "/saas-workshop/kubectlPrivateSubnetIds",
      stringValue: clusterInfo.cluster.kubectlPrivateSubnets?.join() || "N/A",
    });

    new ssm.StringParameter(this, "clusterSecurityGroupIdParameter", {
      parameterName: "/saas-workshop/clusterSecurityGroupId",
      stringValue: clusterInfo.cluster.clusterSecurityGroupId,
    });

    new ssm.StringParameter(this, "openIdConnectProviderArnParameter", {
      parameterName: "/saas-workshop/openIdConnectProviderArn",
      stringValue:
        clusterInfo.cluster.openIdConnectProvider.openIdConnectProviderArn,
    });
  }
}

export class EksBlueprintStack extends cdk.Stack {
  public readonly clusterInfo: blueprints.ClusterInfo;
  public readonly stack: cdk.Stack;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const account = props.env?.account;
    const region = props.env?.region;

    const blueprint = blueprints.EksBlueprint.builder()
      .resourceProvider("LogGroup", new LogGroupResourceProvider())
      .account(account)
      .region(region)
      .teams(
        new blueprints.PlatformTeam({
          name: "admins",
          userRoleArn: `arn:aws:iam::${account}:role/Admin`,
        })
      )
      .addOns(
        new blueprints.addons.MetricsServerAddOn(),
        new MyCustomAwsForFluentBitAddOn()
      )
      .clusterProvider(
        new blueprints.MngClusterProvider({
          nodegroupName: "instance-capacity",
          version: KubernetesVersion.V1_23,
          minSize: 2,
          desiredSize: 2,
          maxSize: 4,
          nodeGroupCapacityType: CapacityType.ON_DEMAND,
          amiType: eks.NodegroupAmiType.AL2_X86_64, // Switching to Bottlerocket breaks Fluentbit's ability to parse log messages as json with its current config!
          instanceTypes: [
            new ec2.InstanceType("m6i.xlarge"),
            new ec2.InstanceType("r6i.xlarge"),
            new ec2.InstanceType("m4.xlarge"),
            new ec2.InstanceType("c4.xlarge"),
          ],
        })
      )
      .build(this, `EKSStack`);

    blueprint
      .getClusterInfo()
      .nodeGroups?.forEach((nodeGroup) =>
        nodeGroup.role.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonSSMManagedInstanceCore"
          )
        )
      );

    const kubectlRole = blueprint.getClusterInfo().cluster.kubectlRole
    if (kubectlRole) {
      const role = kubectlRole as iam.Role;
      role.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        principals: [new iam.AnyPrincipal().withConditions({
            ArnEquals: {'aws:PrincipalArn': `arn:aws:iam::${this.account}:role/*`}
        })]
      }))
    }

    this.stack = blueprint;
    this.clusterInfo = blueprint.getClusterInfo();

    const createCloud9InstanceParameter = new cdk.CfnParameter(
      blueprint,
      "createCloud9Instance",
      {
        type: "String",
        allowedValues: ["true", "false"],
        default: "true",
      }
    );

    new extensionStack(
      blueprint,
      "extensionStack",
      props,
      blueprint.getClusterInfo(),
      createCloud9InstanceParameter
    );
  }
}
