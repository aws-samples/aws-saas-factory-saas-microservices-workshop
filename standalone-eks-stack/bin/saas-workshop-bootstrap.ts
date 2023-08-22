#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as blueprints from "@aws-quickstart/eks-blueprints";
import { CapacityType, KubernetesVersion } from "aws-cdk-lib/aws-eks";
import { ExtensionStack } from "../lib/extension-stack";
import { DestroyPolicySetter } from "../lib/cdk-aspect/destroy-policy-setter";
import {
  LogGroupResourceProvider,
  MyCustomAwsForFluentBitAddOn,
} from "../lib/fluentbit";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
const isWorkshopStudioEnv = process.env.IS_WORKSHOP_STUDIO_ENV || "false";
const ownerArn = process.env.OWNER_ARN;
const repositoryUrl =
  "https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop";

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
    new MyCustomAwsForFluentBitAddOn(),
    new blueprints.addons.MetricsServerAddOn(),
    new blueprints.addons.ContainerInsightsAddOn(),
    new blueprints.addons.IstioBaseAddOn(),
    new blueprints.addons.IstioControlPlaneAddOn()
  )
  .clusterProvider(
    new blueprints.MngClusterProvider({
      version: KubernetesVersion.V1_26,
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
  .build(app, "SaaSWorkshopBootstrap");

blueprint
  .getClusterInfo()
  .nodeGroups?.forEach((nodeGroup) =>
    nodeGroup.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    )
  );

const kubectlRole = blueprint.getClusterInfo().cluster.kubectlRole;
if (kubectlRole) {
  const role = kubectlRole as iam.Role;
  role.assumeRolePolicy?.addStatements(
    new iam.PolicyStatement({
      actions: ["sts:AssumeRole"],
      principals: [
        new iam.AnyPrincipal().withConditions({
          ArnEquals: {
            "aws:PrincipalArn": `arn:aws:iam::${account}:role/*`,
          },
        }),
      ],
    })
  );
}

new ExtensionStack(blueprint, "extensionStack", {
  clusterInfo: blueprint.getClusterInfo(),
  createCloud9Instance: isWorkshopStudioEnv == "true" ? true : false,
  repositoryUrl: repositoryUrl,
  workshopSSMPrefix: "/saas-workshop",
  ownerArn: ownerArn,
});

cdk.Aspects.of(blueprint).add(new DestroyPolicySetter());
