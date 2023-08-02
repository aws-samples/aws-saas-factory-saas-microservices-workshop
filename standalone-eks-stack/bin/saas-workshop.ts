#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EksBlueprintStack } from "../lib/eks/eks-blueprint-stack";
import { DestroyPolicySetter } from "../lib/cdk-aspect/destroy-policy-setter";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

const eksBlueprintStack = new EksBlueprintStack(app, "eksBlueprintStack", {
  stackName: "saas-workshop-eksBlueprintStack",
  env: { account, region },
});

// Remove comment to display failed checks.
// cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

cdk.Aspects.of(eksBlueprintStack).add(new DestroyPolicySetter());
