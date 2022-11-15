import { MicroserviceStackProps } from "./microservice-props";

export interface MicroserviceAdvancedTierStackProps
  extends MicroserviceStackProps {
  tenantId: string;
}
