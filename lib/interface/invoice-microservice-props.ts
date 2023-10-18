import { MicroserviceStackProps } from "./microservice-props";

export interface InvoiceMicroserviceStackProps extends MicroserviceStackProps {
  productServiceDNS: string;
}
