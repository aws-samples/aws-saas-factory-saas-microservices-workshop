import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class EksBlueprintStack extends cdk.NestedStack {
  public readonly clusterInfo: any;
  public readonly stack: cdk.Stack;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const account = props?.env?.account;
    const region = props?.env?.region;
    const workshopSSMPrefix = "/saas-workshop";

    const clusterName = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/clusterName`
    );

    const kubectlRoleArn = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/kubectlRoleArn`
    );

    const kubectlPrivateSubnetIds = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/kubectlPrivateSubnetIds`
    );

    const kubectlSecurityGroupId = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/kubectlSecurityGroupId`
    );

    const clusterSecurityGroupId = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/clusterSecurityGroupId`
    );

    // using valueFromLookup, so we can determine during synth
    // whether or not to configure a layer for the imported cluster.
    const kubectlLayerVersionArn = ssm.StringParameter.valueFromLookup(
      this,
      `${workshopSSMPrefix}/kubectlLayerVersionArn`
    );

    const kubectlLayer = kubectlLayerVersionArn.includes("N/A")
      ? undefined
      : lambda.LayerVersion.fromLayerVersionArn(
          this,
          "kubectlLayerImported",
          kubectlLayerVersionArn
        );

    // using valueFromLookup, so we can determine during synth
    // whether or not to configure a layer for the imported cluster.
    const awscliLayerVersionArn = ssm.StringParameter.valueFromLookup(
      this,
      `${workshopSSMPrefix}/awscliLayerVersionArn`
    );

    const awscliLayer = awscliLayerVersionArn.includes("N/A")
      ? undefined
      : lambda.LayerVersion.fromLayerVersionArn(
          this,
          "awscliLayerImported",
          awscliLayerVersionArn
        );

    const openIdConnectProviderArn =
      ssm.StringParameter.valueForStringParameter(
        this,
        `${workshopSSMPrefix}/openIdConnectProviderArn`
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
        kubectlSecurityGroupId: kubectlSecurityGroupId,
        kubectlPrivateSubnetIds: kubectlPrivateSubnetIds.split(","),
        kubectlLayer: kubectlLayer,
        awscliLayer: awscliLayer,
        clusterSecurityGroupId: clusterSecurityGroupId,
        openIdConnectProvider: openIdConnectProvider,
      }
    );

    this.stack = this;

    this.clusterInfo = {
      cluster: importedCluster,
    };
  }
}
