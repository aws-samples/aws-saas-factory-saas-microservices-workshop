import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as blueprints from "@aws-quickstart/eks-blueprints";
import { CapacityType, KubernetesVersion } from "aws-cdk-lib/aws-eks";

export class extensionStack extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: {
      clusterInfo: blueprints.ClusterInfo;
      createCloud9InstanceParameter: cdk.CfnParameter;
    }
  ) {
    super(scope, id);

    const clusterInfo = props.clusterInfo;
    const createCloud9InstanceParameter = props.createCloud9InstanceParameter;
    const workshopSSMPrefix = "/saas-workshop";

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
      parameterName: `${workshopSSMPrefix}/clusterName`,
      stringValue: clusterInfo.cluster.clusterName,
    });

    new ssm.StringParameter(this, "kubectlRoleNameParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlRoleNameParameter`,
      stringValue: clusterInfo.cluster.kubectlRole?.roleName || "N/A",
    });

    new ssm.StringParameter(this, "kubectlRoleArnParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlRoleArn`,
      stringValue: clusterInfo.cluster.kubectlRole?.roleArn || "N/A",
    });

    new ssm.StringParameter(this, "kubectlLambdaRoleArnParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlLambdaRoleArnParameter`,
      stringValue: clusterInfo.cluster.kubectlLambdaRole?.roleArn || "N/A",
    });

    new ssm.StringParameter(this, "kubectlProviderKubectlRoleArn", {
      parameterName: `${workshopSSMPrefix}/kubectlProviderKubectlRoleArn`,
      stringValue: clusterInfo.cluster.kubectlProvider?.roleArn || "N/A",
    });
    new ssm.StringParameter(this, "kubectlProviderFunctionArn", {
      parameterName: `${workshopSSMPrefix}/kubectlProviderFunctionArn`,
      stringValue: clusterInfo.cluster.kubectlProvider?.serviceToken || "N/A",
    });
    new ssm.StringParameter(this, "kubectlProviderHandlerRoleArn", {
      parameterName: `${workshopSSMPrefix}/kubectlProviderHandlerRoleArn`,
      stringValue:
        clusterInfo.cluster.kubectlProvider?.handlerRole.roleArn || "N/A",
    });

    new ssm.StringParameter(this, "kubectlLayerVersionArnParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlLayerVersionArn`,
      stringValue: clusterInfo.cluster.kubectlLayer?.layerVersionArn || "N/A",
    });

    new ssm.StringParameter(this, "awscliLayerVersionArnParameter", {
      parameterName: `${workshopSSMPrefix}/awscliLayerVersionArn`,
      stringValue: clusterInfo.cluster.awscliLayer?.layerVersionArn || "N/A",
    });

    new ssm.StringParameter(this, "kubectlSecurityGroupIdParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlSecurityGroupId`,
      stringValue:
        clusterInfo.cluster.kubectlSecurityGroup?.securityGroupId || "N/A",
    });

    new ssm.StringListParameter(this, "kubectlPrivateSubnetIdsParameter", {
      parameterName: `${workshopSSMPrefix}/kubectlPrivateSubnetIds`,
      stringListValue: clusterInfo.cluster.kubectlPrivateSubnets?.map(
        (x) => x.subnetId
      ) || ["N/A"],
    });

    new ssm.StringParameter(this, "clusterSecurityGroupIdParameter", {
      parameterName: `${workshopSSMPrefix}/clusterSecurityGroupId`,
      stringValue: clusterInfo.cluster.clusterSecurityGroupId,
    });

    new ssm.StringParameter(this, "openIdConnectProviderArnParameter", {
      parameterName: `${workshopSSMPrefix}/openIdConnectProviderArn`,
      stringValue:
        clusterInfo.cluster.openIdConnectProvider.openIdConnectProviderArn,
    });

    new ssm.StringParameter(this, "vpcIdParameter", {
      parameterName: `${workshopSSMPrefix}/vpcIdParameter`,
      stringValue: clusterInfo.cluster.vpc.vpcId,
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
    const fluentBitLogGroup = new logs.LogGroup(this, "fluent-bit-log-group", {
      logGroupName: "/saas-workshop/eks/fluent-bit/container-logs",
      retention: 7,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const blueprint = blueprints.EksBlueprint.builder()
      .account(account)
      .region(region)
      .teams(
        new blueprints.PlatformTeam({
          name: "admins",
          userRoleArn: `arn:aws:iam::${account}:role/Admin`,
        })
      )
      .addOns(
        new blueprints.addons.AwsForFluentBitAddOn({
          values: {
            cloudWatch: {
              enabled: true,
              region: cdk.Stack.of(this).region,
              logGroupName: fluentBitLogGroup.logGroupName,
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
        }),
        new blueprints.addons.MetricsServerAddOn(),
        // new blueprints.addons.ContainerInsightsAddOn(),
        new blueprints.addons.AwsLoadBalancerControllerAddOn(),
        new blueprints.addons.CertManagerAddOn(),
        new blueprints.addons.AdotCollectorAddOn(),
        new blueprints.addons.CloudWatchAdotAddOn(),
        new blueprints.addons.XrayAdotAddOn(),
        new blueprints.addons.IstioBaseAddOn(),
        new blueprints.addons.IstioControlPlaneAddOn()
      )
      .clusterProvider(
        new blueprints.MngClusterProvider({
          version: KubernetesVersion.V1_27,
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

    new extensionStack(blueprint, "extensionStack", {
      clusterInfo: blueprint.getClusterInfo(),
      createCloud9InstanceParameter: createCloud9InstanceParameter,
    });
  }
}
