import * as eks from "aws-cdk-lib/aws-eks";

export interface AddOnStackProps {
  cluster: eks.ICluster;
}
