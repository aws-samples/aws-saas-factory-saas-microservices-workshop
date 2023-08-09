#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TokenVendorStack } from "../lib/token-vendor/infrastructure/token-vendor-stack";
import { ApplicationStack } from "../lib/environment/application-stack";
import { BaseStack } from "../lib/base/base-stack";
import { ApplicationAdvancedTierStack } from "../lib/environment/application-advanced-tier-stack";
import { Tier } from "../lib/enums/tier";
import { DestroyPolicySetter } from "../lib/cdk-aspect/destroy-policy-setter";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
const deploymentMode = process.env.CDK_PARAM_DEPLOYMENT_MODE || "all";
const tlsCertIstio = process.env.CDK_PARAM_TLS_CERT_ISTIO;
const tlsKeyIstio = process.env.CDK_PARAM_TLS_KEY_ISTIO;

if (!tlsCertIstio || !tlsKeyIstio) {
  throw new Error(
    "Please provide the TLS certificate and key for Istio in the environment variables."
  );
}

const baseStack = new BaseStack(app, "SaaSMicroserviceBaseStack", {
  env: { account, region },
  stackName: "SaaS-Microservices-Base-Stack",
  tlsCertIstio: tlsCertIstio,
  tlsKeyIstio: tlsKeyIstio,
});

const tokenVendorStack = new TokenVendorStack(app, "TokenVendorStack", {
  env: { account, region },
});

const basicStack = new ApplicationStack(app, "PoolBasicStack", {
  env: { account, region },
  baseStack: baseStack,
  tier: Tier.Basic,
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  deploymentMode: deploymentMode,
});
basicStack.addDependency(baseStack);

const tenantBstack = new ApplicationAdvancedTierStack(app, "tenantBstack", {
  env: { account, region },
  baseStack: baseStack,
  basicStack: basicStack,
  namespace: basicStack.namespace,
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  deploymentMode: deploymentMode,
  tenantId: "tenant-b",
});
tenantBstack.addDependency(baseStack);
tenantBstack.addDependency(basicStack);

const tenantCstack = new ApplicationStack(app, "tenantCstack", {
  env: { account, region },
  baseStack: baseStack,
  basicStack: basicStack,
  tenantId: "tenant-c",
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  deploymentMode: deploymentMode,
  tier: Tier.Premium,
});
tenantCstack.addDependency(baseStack);
tenantCstack.addDependency(basicStack);

// Set destroy policies to all stacks.
const stacks = [
  baseStack,
  tokenVendorStack,
  basicStack,
  tenantBstack,
  tenantCstack,
];
stacks.forEach((stack) => {
  cdk.Aspects.of(stack).add(new DestroyPolicySetter());
});
