// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { EventBus } from "aws-cdk-lib/aws-events";
import { MicroserviceStackProps } from "./microservice-props";

export interface FulfillmentMicroserviceStackProps
  extends MicroserviceStackProps {
  eventBus: EventBus;
}
