import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as blueprints from "@aws-quickstart/eks-blueprints";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class EksBlueprintStack extends Construct {
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

    const kubectlPrivateSubnetIds =
      ssm.StringListParameter.fromStringListParameterName(
        this,
        "kubectlPrivateSubnetIds",
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

    const kubectlRoleName = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/kubectlRoleNameParameter`
    );

    // ssm.StringParameter.fromStringParameterName(this, )
    const vpcId = ssm.StringParameter.valueForStringParameter(
      this,
      `${workshopSSMPrefix}/vpcIdParameter`
    );

    const kubectlProviderKubectlRoleArn =
      ssm.StringParameter.valueForStringParameter(
        this,
        `${workshopSSMPrefix}/kubectlProviderKubectlRoleArn`
      );

    const kubectlProviderFunctionArn =
      ssm.StringParameter.valueForStringParameter(
        this,
        `${workshopSSMPrefix}/kubectlProviderFunctionArn`
      );

    const kubectlProviderHandlerRoleArn =
      ssm.StringParameter.valueForStringParameter(
        this,
        `${workshopSSMPrefix}/kubectlProviderHandlerRoleArn`
      );
    const kubectlLambdaRoleArnParameter =
      ssm.StringParameter.valueForStringParameter(
        this,
        `${workshopSSMPrefix}/kubectlLambdaRoleArnParameter`
      );

    const kubectlProvider = eks.KubectlProvider.fromKubectlProviderAttributes(
      this,
      "kubectlProvider",
      {
        functionArn: kubectlProviderFunctionArn,
        kubectlRoleArn: kubectlProviderKubectlRoleArn,
        handlerRole: iam.Role.fromRoleArn(
          this,
          "handlerRole",
          kubectlProviderHandlerRoleArn
        ),
      }
    );

    // const sdkCluster = await blueprints.describeCluster(
    //   clusterName,
    //   cdk.Stack.of(this).region
    // );

    // const importClusterProvider =
    //   blueprints.ImportClusterProvider.fromClusterAttributes(
    //     sdkCluster,
    //     blueprints.getResource((context) =>
    //       new blueprints.LookupRoleProvider(kubectlRoleName).provide(context)
    //     )
    //   );

    // const vpcId = sdkCluster.resourcesVpcConfig?.vpcId;

    // const importedCluster = blueprints.EksBlueprint.builder()
    //   .clusterProvider(importClusterProvider)
    //   .resourceProvider(
    //     blueprints.GlobalResources.Vpc,
    //     new blueprints.VpcProvider(vpcId)
    //   ) // Important! register cluster VPC
    //   .build(scope, "imported-cluster");

    const importedCluster = eks.Cluster.fromClusterAttributes(
      this,
      "importedCluster",
      {
        clusterName: clusterName,
        kubectlRoleArn: kubectlRoleArn,
        kubectlLambdaRole: iam.Role.fromRoleArn(
          this,
          "kubectlLambdaRole",
          kubectlLambdaRoleArnParameter
        ),
        kubectlSecurityGroupId: kubectlSecurityGroupId,
        // kubectlPrivateSubnetIds: kubectlPrivateSubnetIds.stringListValue,
        // kubectlLayer: kubectlLayer,
        // awscliLayer: awscliLayer,
        clusterSecurityGroupId: clusterSecurityGroupId,
        openIdConnectProvider: openIdConnectProvider,
        vpc: ec2.Vpc.fromLookup(this, "vpc", {
          vpcId: ssm.StringParameter.valueFromLookup(
            this,
            `${workshopSSMPrefix}/vpcIdParameter`
          ),
          // vpcId: ssm.StringParameter.fromStringParameterName(
          //   this,
          //   "vpcIdParam",
          //   `${workshopSSMPrefix}/vpcIdParameter`
          // ).stringValue,
        }),
      }
    );

    this.cluster = importedCluster;
  }
}
