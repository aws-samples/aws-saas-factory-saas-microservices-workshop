import * as ssm from "aws-cdk-lib/aws-ssm";
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
