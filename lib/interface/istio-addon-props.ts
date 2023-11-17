// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { AddOnStackProps } from "./addon-props";

export interface IstioAddOnStackProps extends AddOnStackProps {
  issuer: string;
  jwksUri: string;
  tlsCert: string;
  tlsKey: string;
}
