// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ApplicationStackProps } from "./application-props";

export interface ApplicationAdvancedTierStackProps
  extends ApplicationStackProps {
  tenantId: string;
  namespace: string;
  workshopSSMPrefix: string;
  baseImage?: string;
}
