import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as eks from "aws-cdk-lib/aws-eks";

export interface MicroserviceStackProps {
  cluster: eks.ICluster;
  xrayServiceDNSAndPort: string;
  cloudwatchAgentEndpoint?: string;
  istioIngressGateway: string;
  applicationImageAsset?: DockerImageAsset;
  sideCarImageAsset?: DockerImageAsset;
  namespace: string;
  namespaceConstruct?: eks.KubernetesManifest;
  tier: string;
  tenantId?: string;
}
