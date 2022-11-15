import { MicroserviceStackProps } from "./microservice-props";

export interface ProductMicroserviceAdvancedTierStackProps
  extends MicroserviceStackProps {
  tenantId: string;
  productServiceDNS: string;
  productServicePort: number;
}
