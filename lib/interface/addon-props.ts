// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as eks from "aws-cdk-lib/aws-eks";

export interface AddOnStackProps {
  cluster: eks.ICluster;
  workshopSSMPrefix?: string;
}
