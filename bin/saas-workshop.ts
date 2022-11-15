#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TokenVendorStack } from "../lib/token-vendor/infrastructure/token-vendor-stack";
import { ApplicationStack } from "../lib/environment/application-stack";
import { BaseStack } from "../lib/base/base-stack";
import { ApplicationAdvancedTierStack } from "../lib/environment/application-advanced-tier-stack";
import { Tier } from "../lib/enums/tier";
import { AwsSolutionsChecks } from "cdk-nag";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

const baseStack = new BaseStack(app, "SaaSMicroserviceBaseStack", {
  env: { account, region },
  stackName: "SaaS-Microservices-Base-Stack",
});

const tokenVendorStack = new TokenVendorStack(app, "TokenVendorStack", {
  env: { account, region },
});

const basicStack = new ApplicationStack(app, "PoolBasicStack", {
  baseStack: baseStack,
  tier: Tier.Basic,
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  env: { account, region },
});
basicStack.addDependency(baseStack);

const tenantBstack = new ApplicationAdvancedTierStack(app, "tenantBstack", {
  baseStack: baseStack,
  basicStack: basicStack,
  namespace: basicStack.namespace,
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  tenantId: "tenant-b",
  env: { account, region },
});
tenantBstack.addDependency(baseStack);
tenantBstack.addDependency(basicStack);

const tenantCstack = new ApplicationStack(app, "tenantCstack", {
  baseStack: baseStack,
  basicStack: basicStack,
  tenantId: "tenant-c",
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  tier: Tier.Premium,
  env: { account, region },
});
tenantCstack.addDependency(baseStack);
tenantCstack.addDependency(basicStack);

// Remove comment to display failed checks.
// cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
