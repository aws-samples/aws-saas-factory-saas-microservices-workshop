import { EventBus } from "aws-cdk-lib/aws-events";
import { MicroserviceStackProps } from "./microservice-props";

export interface FulfillmentMicroserviceStackProps
  extends MicroserviceStackProps {
  eventBus: EventBus;
}
