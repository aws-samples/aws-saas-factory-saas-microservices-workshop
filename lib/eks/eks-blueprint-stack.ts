import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class EksCluster extends Construct {
  public readonly cluster: eks.ICluster;
  public readonly stack: cdk.Stack;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const workshopSSMPrefix = "/saas-workshop";

    const clusterName = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/clusterName`
    );

    const kubectlRoleArn = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/kubectlRoleArn`
    );

    const kubectlSecurityGroupId = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/kubectlSecurityGroupId`
    );

    const clusterSecurityGroupId = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/clusterSecurityGroupId`
    );

    const kubectlLambdaRoleArnParameter =
      ssm.StringParameter.valueForStringParameter(
        this,
        `${workshopSSMPrefix}/kubectlLambdaRoleArnParameter`
      );

    const kubectlLayerVersionArn = ssm.StringParameter.valueFromLookup(
      this,
      `${workshopSSMPrefix}/kubectlLayerVersionArn`
    );

    const kubectlLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "kubectlLayerImported",
      kubectlLayerVersionArn
    );

    const awscliLayerVersionArn = ssm.StringParameter.valueFromLookup(
      this,
      `${workshopSSMPrefix}/awscliLayerVersionArn`
    );

    const awscliLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "awscliLayerImported",
      awscliLayerVersionArn
    );

    // read ssm value at synth time instead of deployment
    // as we cannot use a "token" when importing VPC using Vpc.fromLookup
    const vpcId = ssm.StringParameter.valueFromLookup(
      this,
      `${workshopSSMPrefix}/vpcIdParameter`
    );

    const openIdConnectProviderArn =
      ssm.StringParameter.valueForStringParameter(
        this,
        `${workshopSSMPrefix}/openIdConnectProviderArn`
      );

    const vpc = ec2.Vpc.fromLookup(this, "vpc", { vpcId: vpcId });

    const kubectlLambdaRole = iam.Role.fromRoleArn(
      this,
      "kubectlLambdaRole",
      kubectlLambdaRoleArnParameter
    );

    const openIdConnectProvider =
      eks.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this,
        "openIdConnectProvider",
        openIdConnectProviderArn
      );

    const importedCluster = eks.Cluster.fromClusterAttributes(
      this,
      "importedCluster",
      {
        clusterName: clusterName,
        kubectlRoleArn: kubectlRoleArn,
        ...(kubectlLayerVersionArn.includes(":layer:") && {
          kubectlLayer: kubectlLayer,
        }),
        ...(awscliLayerVersionArn.includes(":layer:") && {
          awscliLayer: awscliLayer,
        }),
        kubectlLambdaRole: kubectlLambdaRole,
        kubectlSecurityGroupId: kubectlSecurityGroupId,
        clusterSecurityGroupId: clusterSecurityGroupId,
        openIdConnectProvider: openIdConnectProvider,
        vpc: vpc,
      }
    );

    this.cluster = importedCluster;
  }
}
