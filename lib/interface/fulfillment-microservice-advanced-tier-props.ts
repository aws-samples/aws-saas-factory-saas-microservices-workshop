import { MicroserviceAdvancedTierStackProps } from "./microservice-advanced-tier-props";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";

export interface FulfillmentMicroserviceAdvancedTierStackProps
  extends MicroserviceAdvancedTierStackProps {
  fulfillmentServiceDNS: string;
  fulfillmentServiceDNSPort: number;
  fulfillmentDockerImageAsset: DockerImageAsset;
}
