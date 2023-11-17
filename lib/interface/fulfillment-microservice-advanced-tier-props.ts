// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { MicroserviceAdvancedTierStackProps } from "./microservice-advanced-tier-props";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { EventBus } from "aws-cdk-lib/aws-events";

export interface FulfillmentMicroserviceAdvancedTierStackProps
  extends MicroserviceAdvancedTierStackProps {
  fulfillmentServiceDNS: string;
  fulfillmentServiceDNSPort: number;
  fulfillmentDockerImageAsset: DockerImageAsset;
  eventBus: EventBus;
}
