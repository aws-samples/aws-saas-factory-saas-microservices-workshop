import { MicroserviceStackProps } from "./microservice-props";

export interface OrderMicroserviceStackProps extends MicroserviceStackProps {
  fulfillmentServiceDNS: string;
  fulfillmentServicePort: number;
}
