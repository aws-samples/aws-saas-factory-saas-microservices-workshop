import { MicroserviceStackProps } from "./microservice-props";

export interface InvoiceMicroserviceAdvancedTierStackProps
  extends MicroserviceStackProps {
  tenantId: string;
  // invoiceServiceDNS: string;
  // invoiceServicePort: number;
}
