import { EventBus } from "aws-cdk-lib/aws-events";
import { MicroserviceStackProps } from "./microservice-props";

export interface InvoiceMicroserviceStackProps extends MicroserviceStackProps {
  productServiceDNS: string;
  eventBus: EventBus;
  fulfillmentEventDetailType: string;
  fulfillmentEventSource: string;
}
