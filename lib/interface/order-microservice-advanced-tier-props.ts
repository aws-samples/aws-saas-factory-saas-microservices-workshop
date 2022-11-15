import { MicroserviceStackProps } from "./microservice-props";

export interface OrderMicroserviceAdvancedTierStackProps
  extends MicroserviceStackProps {
  tenantId: string;
  orderServiceDNS: string;
  orderServicePort: number;
}
