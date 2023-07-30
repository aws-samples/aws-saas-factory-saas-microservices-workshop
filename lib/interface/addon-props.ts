import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";

export interface AddOnStackProps extends cdk.NestedStackProps {
  cluster: eks.ICluster;
}
