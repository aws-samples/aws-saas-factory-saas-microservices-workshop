#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as blueprints from "@aws-quickstart/eks-blueprints";
import { CapacityType, KubernetesVersion } from "aws-cdk-lib/aws-eks";
import { Cloud9Resources } from "../lib/cloud9-resources";
import { DestroyPolicySetter } from "../lib/cdk-aspect/destroy-policy-setter";
import { SSMResources } from "../lib/ssm-resources";
import { SharedStack } from "../lib/shared/infrastructure/shared-stack";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
const isWorkshopStudioEnv = process.env.IS_WORKSHOP_STUDIO_ENV || "no";
const participantAssumedRoleArn = process.env.PARTICIPANT_ASSUMED_ROLE_ARN;
const workshopSSMPrefix = "/saas-workshop";
const cloud9ConnectionType = "CONNECT_SSM";
const cloud9InstanceType = "m5.large";
const cloud9ImageId = "ubuntu-22.04-x86_64";

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
    new blueprints.addons.IstioBaseAddOn(),
    new blueprints.addons.IstioControlPlaneAddOn()
  )
  .clusterProvider(
    new blueprints.MngClusterProvider({
      version: KubernetesVersion.V1_27,
      minSize: 2,
      desiredSize: 2,
      maxSize: 4,
      nodeGroupCapacityType: CapacityType.SPOT,
      // nodeGroupCapacityType: CapacityType.ON_DEMAND,
      amiType: eks.NodegroupAmiType.BOTTLEROCKET_X86_64,
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

const sharedStack = new SharedStack(blueprint, "SharedStack");

new SSMResources(blueprint, "SSMResources", {
  clusterInfo: blueprint.getClusterInfo(),
  workshopSSMPrefix: workshopSSMPrefix,
  sharedImageAsset: sharedStack.sharedImageAsset,
});

new Cloud9Resources(blueprint, "Cloud9Resources", {
  createCloud9Instance: true,
  workshopSSMPrefix: workshopSSMPrefix,
  cloud9MemberArn: participantAssumedRoleArn,
  cloud9ConnectionType: cloud9ConnectionType,
  cloud9InstanceType: cloud9InstanceType,
  cloud9ImageId: cloud9ImageId,
});

cdk.Aspects.of(blueprint).add(new DestroyPolicySetter());
cdk.Tags.of(blueprint).add("SaaSMicroservicesWorkshop", "BootstrapResources");
