import * as cdk from "aws-cdk-lib";
import { ClusterInfo } from "@aws-quickstart/eks-blueprints";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as eks from "aws-cdk-lib/aws-eks";

export interface MicroserviceStackProps extends cdk.StackProps {
  clusterInfo: {
    cluster: eks.Cluster;
  };
  xrayServiceDNSAndPort: string;
  istioIngressGateway: string;
  applicationImageAsset?: DockerImageAsset;
  sideCarImageAsset?: DockerImageAsset;
  namespace: string;
  tier: string;
  tenantId?: string;
}
