import * as cdk from "aws-cdk-lib";
import { ClusterInfo } from "@aws-quickstart/eks-blueprints";
import * as eks from "aws-cdk-lib/aws-eks";

export interface AddOnStackProps extends cdk.NestedStackProps {
  clusterInfo: {
    cluster: eks.Cluster;
  };
}
