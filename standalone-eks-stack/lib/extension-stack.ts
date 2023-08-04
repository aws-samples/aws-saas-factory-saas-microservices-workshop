import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as blueprints from "@aws-quickstart/eks-blueprints";

export class ExtensionStack extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: {
      clusterInfo: blueprints.ClusterInfo;
      createCloud9InstanceParameter: cdk.CfnParameter;
      workshopSSMPrefix: string;
    }
  ) {
    super(scope, id);

    const clusterInfo = props.clusterInfo;
    const createCloud9InstanceParameter = props.createCloud9InstanceParameter;
    const workshopSSMPrefix = props.workshopSSMPrefix;

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
