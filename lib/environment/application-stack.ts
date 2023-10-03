import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ProductStack } from "../product/infrastructure/product-stack";
import { FulfillmentStack } from "../fulfillment/infrastructure/fulfillment-stack";
import { ApplicationStackProps } from "../interface/application-props";
import { OrderStack } from "../order/infrastructure/order-stack";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Tier } from "../enums/tier";
import { EksCluster } from "../eks/eks-blueprint-stack";

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
  public readonly namespace: string;

  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    if (props.baseStack == undefined) {
      throw new Error("Missing definition for baseStack!");
    }

    const deploymentMode = props.deploymentMode;

    const eksCluster = new EksCluster(this, "EksCluster");
    const cluster = eksCluster.cluster;
    const xrayServiceDNSAndPort =
      props.baseStack.xrayAddOnStack.xrayServiceDNSAndPort;
    const cloudwatchAgentEndpoint =
      props.baseStack.cloudwatchAgentAddOnStack.cloudwatchAgentEndpoint;
    const istioIngressGateway =
      props.baseStack.istioResources.istioIngressGateway;

    const tier = props.tier;
    const tenantId = props.tenantId;
    const sideCarImageAsset = props.sideCarImageAsset;

    if (tier != Tier.Basic && tier != Tier.Premium) {
      throw new Error(`Tier: "${tier}" not supported!`);
    }

    // Application environment kubernetes namespace
    this.namespace = tenantId ? `${tenantId}` : `${tier}-pool`;

    const stackNamespace = cluster.addManifest(`StackNamespaceManifest`, {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: this.namespace,
        labels: {
          "istio-injection": "enabled",
          tier: tier,
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
      tier: tier,
      tenantId: tenantId,
      xrayServiceDNSAndPort: xrayServiceDNSAndPort,
      cloudwatchAgentEndpoint: cloudwatchAgentEndpoint,
      namespaceConstruct: stackNamespace,
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
        tier: tier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        namespaceConstruct: stackNamespace,
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
        tier: tier,
        tenantId: tenantId,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        namespaceConstruct: stackNamespace,
      });
      orderStack.node.addDependency(stackNamespace);
      this.orderServiceDNS = orderStack.orderServiceDNS;
      this.orderServicePort = orderStack.orderServicePort;
      this.orderDockerImageAsset = orderStack.orderDockerImageAsset;
    }
  }
}
