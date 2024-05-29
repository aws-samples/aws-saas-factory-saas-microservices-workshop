// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as eks from "aws-cdk-lib/aws-eks";
import { TenantTier } from "../enums/tenant-tier";

export interface MicroserviceStackProps {
  //baseImage?: DockerImageAsset;
  baseImage?: string
  cluster: eks.ICluster;
  cloudwatchAgentLogEndpoint: string;
  cloudwatchAgentLogGroupName: string;
  istioIngressGateway: string;
  applicationImageAsset?: DockerImageAsset;
  sideCarImageAsset?: DockerImageAsset;
  namespace: string;
  namespaceConstruct?: eks.KubernetesManifest;
  tenantTier: TenantTier;
  tenantId?: string;
  policyStoreArn?: string;
  policyStoreId?: string;
}
