import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as eks from "aws-cdk-lib/aws-eks";

export interface MicroserviceStackProps {
  baseImage?: string;
  cluster: eks.ICluster;
  xrayServiceDNSAndPort: string;
  cloudwatchAgentLogEndpoint: string;
  cloudwatchAgentLogGroupName: string;
  istioIngressGateway: string;
  applicationImageAsset?: DockerImageAsset;
  sideCarImageAsset?: DockerImageAsset;
  namespace: string;
  namespaceConstruct?: eks.KubernetesManifest;
  tier: string;
  tenantId?: string;
}
