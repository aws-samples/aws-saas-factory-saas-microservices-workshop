// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { MicroserviceStackProps } from "./microservice-props";

export interface OrderMicroserviceStackProps extends MicroserviceStackProps {
  fulfillmentServiceDNS: string;
  fulfillmentServicePort: number;
}
