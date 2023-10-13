import * as sqs from "aws-cdk-lib/aws-sqs";
import { MicroserviceStackProps } from "./microservice-props";

export interface InvoiceMicroserviceStackProps extends MicroserviceStackProps {
  fulfillmentQueue: sqs.Queue;
  productServiceDNS: string;
}
