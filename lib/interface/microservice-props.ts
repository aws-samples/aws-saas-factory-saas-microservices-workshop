import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as eks from "aws-cdk-lib/aws-eks";
import { TenantTier } from "../enums/tenant-tier";

export interface MicroserviceStackProps {
  baseImage?: string;
  cluster: eks.ICluster;
  cloudwatchAgentLogEndpoint: string;
  cloudwatchAgentLogGroupName: string;
  istioIngressGateway: string;
  applicationImageAsset?: DockerImageAsset;
  sideCarImageAsset?: DockerImageAsset;
  namespace: string;
  namespaceConstruct?: eks.KubernetesManifest;
  tenantTier: TenantTier;
  tenantId?: string;
}
