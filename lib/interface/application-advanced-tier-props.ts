import { ApplicationStackProps } from "./application-props";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";

export interface ApplicationAdvancedTierStackProps
  extends ApplicationStackProps {
  tenantId: string;
  namespace: string;
}
