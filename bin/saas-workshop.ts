#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TokenVendorStack } from "../lib/token-vendor/infrastructure/token-vendor-stack";
import { ApplicationStack } from "../lib/environment/application-stack";
import { BaseStack } from "../lib/base/base-stack";
import { ApplicationAdvancedTierStack } from "../lib/environment/application-advanced-tier-stack";
import { HelperLibraryBaseImageStack } from "../lib/shared/infrastructure/shared-stack";
import { TenantTier } from "../lib/enums/tenant-tier";
import { DestroyPolicySetter } from "../lib/cdk-aspect/destroy-policy-setter";
import { WorkshopDashboardStack } from "../lib/monitoring/cw-dashboard";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
const deploymentMode = process.env.CDK_PARAM_DEPLOYMENT_MODE || "all";
const tlsCertIstio = process.env.CDK_PARAM_TLS_CERT_ISTIO;
const tlsKeyIstio = process.env.CDK_PARAM_TLS_KEY_ISTIO;
const helperLibraryBaseImageUri = process.env.HELPER_LIBRARY_BASE_IMAGE;
const workshopSSMPrefix = "/workshop";

if (!tlsCertIstio || !tlsKeyIstio) {
  throw new Error(
    "Please provide the TLS certificate and key for Istio in the environment variables."
  );
}

const libStack = new HelperLibraryBaseImageStack(
  app,
  "HelperLibraryBaseImageStack"
);

const baseStack = new BaseStack(app, "SaaSMicroserviceBaseStack", {
  env: { account, region },
  stackName: "SaaS-Microservices-Base-Stack",
  tlsCertIstio: tlsCertIstio,
  tlsKeyIstio: tlsKeyIstio,
  workshopSSMPrefix: workshopSSMPrefix,
});

const tokenVendorStack = new TokenVendorStack(app, "TokenVendorStack", {
  env: { account, region },
});

const basicStack = new ApplicationStack(app, "PoolBasicStack", {
  env: { account, region },
  baseStack: baseStack,
  tenantTier: TenantTier.Basic,
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  deploymentMode: deploymentMode,
  workshopSSMPrefix: workshopSSMPrefix,
  helperLibraryBaseImageUri: helperLibraryBaseImageUri,
});
basicStack.node.addDependency(baseStack);

const tenantBstack = new ApplicationAdvancedTierStack(app, "tenantBstack", {
  env: { account, region },
  baseStack: baseStack,
  basicStack: basicStack,
  namespace: basicStack.namespace,
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  deploymentMode: deploymentMode,
  tenantId: "tenant-b",
  workshopSSMPrefix: workshopSSMPrefix,
  helperLibraryBaseImageUri: helperLibraryBaseImageUri,
});
tenantBstack.node.addDependency(basicStack);

const tenantEstack = new ApplicationAdvancedTierStack(app, "tenantEstack", {
  env: { account, region },
  baseStack: baseStack,
  basicStack: basicStack,
  namespace: basicStack.namespace,
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  deploymentMode: deploymentMode,
  tenantId: "tenant-e",
  workshopSSMPrefix: workshopSSMPrefix,
  helperLibraryBaseImageUri: helperLibraryBaseImageUri,
});
tenantEstack.node.addDependency(basicStack);

const tenantCstack = new ApplicationStack(app, "tenantCstack", {
  env: { account, region },
  baseStack: baseStack,
  basicStack: basicStack,
  tenantId: "tenant-c",
  sideCarImageAsset: tokenVendorStack.tokenVendorImage,
  deploymentMode: deploymentMode,
  tenantTier: TenantTier.Premium,
  workshopSSMPrefix: workshopSSMPrefix,
  helperLibraryBaseImageUri: helperLibraryBaseImageUri,
});
tenantCstack.node.addDependency(basicStack);

const workshopDashboardStack = new WorkshopDashboardStack(
  app,
  "workshopDashboardStack",
  {
    namespace: "workshop-metrics",
    workshopSSMPrefix: workshopSSMPrefix,
  }
);

// Set destroy policies to all stacks.
const stacks = [
  baseStack,
  tokenVendorStack,
  basicStack,
  tenantBstack,
  tenantCstack,
  tenantEstack,
  workshopDashboardStack,
];
stacks.forEach((stack) => {
  cdk.Aspects.of(stack).add(new DestroyPolicySetter());
});
