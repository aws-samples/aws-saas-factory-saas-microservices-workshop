// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { TenantTier } from "../enums/tenant-tier";
import { BaseStack } from "../base/base-stack";
import { ApplicationStack } from "../environment/application-stack";

export interface ApplicationStackProps extends cdk.StackProps {
  tenantTier?: TenantTier;
  sideCarImageAsset?: DockerImageAsset;
  tenantId?: string;
  baseStack?: BaseStack;
  basicStack?: ApplicationStack;
  deploymentMode: string;
  workshopSSMPrefix: string;
  helperLibraryBaseImageUri?: string;
}
