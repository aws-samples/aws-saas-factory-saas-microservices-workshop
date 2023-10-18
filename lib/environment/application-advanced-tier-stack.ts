import * as cdk from "aws-cdk-lib";
import * as aws_events from "aws-cdk-lib/aws-events";
import * as aws_events_targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import { ApplicationAdvancedTierStackProps } from "../interface/application-advanced-tier-props";
import { FulfillmentAdvancedTierStack } from "../fulfillment/infrastructure/fulfillment-advanced-tier-stack";
import { OrderAdvancedTierStack } from "../order/infrastructure/order-advanced-tier-stack";
import { ProductAdvancedTierStack } from "../product/infrastructure/product-advanced-tier-stack";
import { EksCluster } from "../eks/eks-blueprint-stack";
import { Tier } from "../enums/tier";
import { InvoiceStack } from "../invoice/infrastructure/invoice-stack";

export class ApplicationAdvancedTierStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: ApplicationAdvancedTierStackProps
  ) {
    super(scope, id, props);

    if (props.baseStack == undefined || props.basicStack == undefined) {
      throw new Error("Missing definition for baseStack or basicStack!");
    }

    const tier = Tier.Advanced;
    const tenantId = props.tenantId;
    const eksCluster = new EksCluster(this, "EksCluster", {
      workshopSSMPrefix: props.workshopSSMPrefix,
    });
    const cluster = eksCluster.cluster;

    const istioIngressGateway =
      props.baseStack.istioResources.istioIngressGateway;
    const sideCarImageAsset = props.sideCarImageAsset;

    const namespace = props.basicStack.namespace;
    const fulfillmentServiceDNS = props.basicStack.fulfillmentServiceDNS;
    const fulfillmentServicePort = props.basicStack.fulfillmentServicePort;
    const fulfillmentDockerImageAsset =
      props.basicStack.fulfillmentDockerImageAsset;
    const productServiceDNS = props.basicStack.productServiceDNS;
    const productServicePort = props.basicStack.productServicePort;
    const orderServiceDNS = props.basicStack.orderServiceDNS;
    const orderServicePort = props.basicStack.orderServicePort;
    const xrayServiceDNSAndPort =
      props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentXrayEndpoint;
    const cloudwatchAgentLogEndpoint =
      props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentLogEndpoint;
    const cloudwatchAgentLogGroupName =
      props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentLogGroup
        .logGroupName;

    const advancedTierEventBus = props.baseStack.advancedTierEventBus;

    const productAdvancedTierStack = new ProductAdvancedTierStack(
      this,
      "productAdvancedTierStack",
      {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        productServiceDNS: productServiceDNS,
        productServicePort: productServicePort,
        namespace: namespace,
        tier: tier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
      }
    );

    const tenantSpecificAdvancedTierNamespaceName = `${tenantId}`;
    const tenantSpecificAdvancedTierNamespace = cluster.addManifest(
      "tenant-specific-advanced-tier-namespace-manifest",
      {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
          name: tenantSpecificAdvancedTierNamespaceName,
          labels: {
            "istio-injection": "enabled",
            tier: tier,
            ...(tenantId && {
              tenantId: tenantId,
            }),
          },
        },
      }
    );

    const fulfillmentAdvancedTierStack = new FulfillmentAdvancedTierStack(
      this,
      "fulfillmentAdvancedTierStack",
      {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        fulfillmentServiceDNS: fulfillmentServiceDNS,
        fulfillmentServiceDNSPort: fulfillmentServicePort,
        fulfillmentDockerImageAsset: fulfillmentDockerImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        namespace: tenantSpecificAdvancedTierNamespaceName,
        tier: tier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        namespaceConstruct: tenantSpecificAdvancedTierNamespace,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
        eventBus: advancedTierEventBus,
      }
    );
    fulfillmentAdvancedTierStack.node.addDependency(
      tenantSpecificAdvancedTierNamespace
    );

    const orderAdvancedTierStack = new OrderAdvancedTierStack(
      this,
      "orderAdvancedTierStack",
      {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        orderServiceDNS: orderServiceDNS,
        orderServicePort: orderServicePort,
        namespace: namespace,
        tier: tier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
      }
    );

    const invoiceStack = new InvoiceStack(this, "invoiceAdvancedTierStack", {
      cluster: cluster,
      istioIngressGateway: istioIngressGateway,
      namespace: tenantSpecificAdvancedTierNamespaceName,
      productServiceDNS: productServiceDNS,
      applicationImageAsset: props.basicStack?.invoiceImageAsset,
      sideCarImageAsset: sideCarImageAsset,
      tier: tier,
      tenantId: tenantId,
      xrayServiceDNSAndPort: xrayServiceDNSAndPort,
      cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
      cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
      namespaceConstruct: tenantSpecificAdvancedTierNamespace,
    });
    invoiceStack.node.addDependency(fulfillmentAdvancedTierStack);

    const invoiceQueueTarget = new aws_events_targets.SqsQueue(
      invoiceStack.invoiceQueue
    );
    const invoiceRule = new aws_events.Rule(this, "invoiceRule", {
      eventBus: advancedTierEventBus,
      eventPattern: {
        detailType: [fulfillmentAdvancedTierStack.eventDetailType],
        source: [fulfillmentAdvancedTierStack.eventSource],
      },
      targets: [invoiceQueueTarget],
    });
  }
}
