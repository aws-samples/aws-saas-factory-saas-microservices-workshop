import * as cdk from "aws-cdk-lib";
import * as aws_events from "aws-cdk-lib/aws-events";
import * as aws_events_targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { ProductStack } from "../product/infrastructure/product-stack";
import { FulfillmentStack } from "../fulfillment/infrastructure/fulfillment-stack";
import { ApplicationStackProps } from "../interface/application-props";
import { OrderStack } from "../order/infrastructure/order-stack";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { TenantTier } from "../enums/tenant-tier";
import { EksCluster } from "../eks/eks-blueprint-stack";
import { InvoiceStack } from "../invoice/infrastructure/invoice-stack";

export class ApplicationStack extends cdk.Stack {
  public readonly fulfillmentServiceDNS: string;
  public readonly fulfillmentServicePort: number;
  public readonly orderServiceDNS: string;
  public readonly orderServicePort: number;
  public readonly productServiceDNS: string;
  public readonly productServicePort: number;
  public readonly fulfillmentDockerImageAsset: DockerImageAsset;
  public readonly productDockerImageAsset: DockerImageAsset;
  public readonly orderDockerImageAsset: DockerImageAsset;
  public readonly invoiceImageAsset: DockerImageAsset;
  public readonly namespace: string;

  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    if (props.baseStack == undefined) {
      throw new Error("Missing definition for baseStack!");
    }

    const deploymentMode = props.deploymentMode;
    const workshopSSMPrefix = props.workshopSSMPrefix;

    const eksCluster = new EksCluster(this, "EksCluster", {
      workshopSSMPrefix: workshopSSMPrefix,
    });
    const cluster = eksCluster.cluster;
    const xrayServiceDNSAndPort =
      props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentXrayEndpoint;
    const cloudwatchAgentLogEndpoint =
      props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentLogEndpoint;
    const cloudwatchAgentLogGroupName =
      props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentLogGroup
        .logGroupName;
    const istioIngressGateway =
      props.baseStack.istioResources.istioIngressGateway;

    const tenantTier = props.tenantTier;
    const tenantId = props.tenantId;
    const sideCarImageAsset = props.sideCarImageAsset;

    if (tenantTier != TenantTier.Basic && tenantTier != TenantTier.Premium) {
      throw new Error(`TenantTier: "${tenantTier}" not supported!`);
    }

    // Application environment kubernetes namespace
    this.namespace = tenantId ? `${tenantId}` : `${tenantTier}-pool`;

    const eventBus = new aws_events.EventBus(
      this,
      `${this.namespace}-event-bus`
    );

    // EVENT WATCHER START
    // This rule allows us to read ALL events sent to the advancedTierEventBus
    const eventBusWatcherRule = new aws_events.Rule(
      this,
      "EventBusWatcherRule",
      {
        eventBus: eventBus,
        enabled: true,
        eventPattern: {
          account: [cdk.Stack.of(this).account],
        },
      }
    );
    eventBusWatcherRule.addTarget(
      new aws_events_targets.CloudWatchLogGroup(
        new logs.LogGroup(this, "watcher-log-group", {
          logGroupName: `${workshopSSMPrefix}/${this.namespace}-event-bus-logs`,
          retention: logs.RetentionDays.ONE_WEEK,
        })
      )
    );
    // EVENT WATCHER END

    const stackNamespace = cluster.addManifest(`StackNamespaceManifest`, {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: this.namespace,
        labels: {
          "istio-injection": "enabled",
          tenantTier: tenantTier,
          ...(tenantId && {
            tenantId: tenantId,
          }),
        },
      },
    });

    const productStack = new ProductStack(this, `ProductStack`, {
      cluster: cluster,
      istioIngressGateway: istioIngressGateway,
      applicationImageAsset: props.basicStack?.productDockerImageAsset,
      sideCarImageAsset: sideCarImageAsset,
      namespace: this.namespace,
      tenantTier: tenantTier,
      tenantId: tenantId,
      xrayServiceDNSAndPort: xrayServiceDNSAndPort,
      cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
      cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
      namespaceConstruct: stackNamespace,
      baseImage: props.baseStack.baseImage,
    });
    productStack.node.addDependency(stackNamespace);
    this.productServiceDNS = productStack.productServiceDNS;
    this.productServicePort = productStack.productServicePort;
    this.productDockerImageAsset = productStack.productImageAsset;

    if (deploymentMode == "all") {
      const fulfillmentStack = new FulfillmentStack(this, "fulfillmentStack", {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        applicationImageAsset: props.basicStack?.fulfillmentDockerImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        namespace: this.namespace,
        tenantTier: tenantTier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
        namespaceConstruct: stackNamespace,
        eventBus: eventBus,
        baseImage: props.baseStack.baseImage,
      });
      fulfillmentStack.node.addDependency(stackNamespace);
      this.fulfillmentServicePort = fulfillmentStack.fulfillmentServicePort;
      this.fulfillmentDockerImageAsset =
        fulfillmentStack.fulfillmentDockerImageAsset;
      this.fulfillmentServiceDNS = fulfillmentStack.fulfillmentServiceDNS;

      const orderStack = new OrderStack(this, "orderStack", {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        namespace: this.namespace,
        fulfillmentServiceDNS: fulfillmentStack.fulfillmentServiceDNS,
        fulfillmentServicePort: fulfillmentStack.fulfillmentServicePort,
        applicationImageAsset: props.basicStack?.orderDockerImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        tenantTier: tenantTier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
        namespaceConstruct: stackNamespace,
        baseImage: props.baseStack.baseImage,
      });
      orderStack.node.addDependency(stackNamespace);
      orderStack.node.addDependency(fulfillmentStack);
      this.orderServiceDNS = orderStack.orderServiceDNS;
      this.orderServicePort = orderStack.orderServicePort;
      this.orderDockerImageAsset = orderStack.orderDockerImageAsset;

      const invoiceStack = new InvoiceStack(this, "invoiceStack", {
        cluster: cluster,
        istioIngressGateway: istioIngressGateway,
        namespace: this.namespace,
        productServiceDNS: productStack.productServiceDNS,
        applicationImageAsset: props.basicStack?.invoiceImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        tenantTier: tenantTier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        cloudwatchAgentLogEndpoint: cloudwatchAgentLogEndpoint,
        cloudwatchAgentLogGroupName: cloudwatchAgentLogGroupName,
        namespaceConstruct: stackNamespace,
        baseImage: props.baseStack.baseImage,
        eventBus: eventBus,
        fulfillmentEventDetailType: fulfillmentStack.eventDetailType,
        fulfillmentEventSource: fulfillmentStack.eventSource,
      });
      invoiceStack.node.addDependency(stackNamespace);
      invoiceStack.node.addDependency(fulfillmentStack);
      this.invoiceImageAsset = invoiceStack.invoiceImageAsset;
    }
  }
}
