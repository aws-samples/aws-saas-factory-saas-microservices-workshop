import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApplicationAdvancedTierStackProps } from "../interface/application-advanced-tier-props";
import { FulfillmentAdvancedTierStack } from "../fulfillment/infrastructure/fulfillment-advanced-tier-stack";
import { OrderAdvancedTierStack } from "../order/infrastructure/order-advanced-tier-stack";
import { ProductAdvancedTierStack } from "../product/infrastructure/product-advanced-tier-stack";
import { EksCluster } from "../eks/eks-blueprint-stack";
import { Tier } from "../enums/tier";

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
    const eksCluster = new EksCluster(this, "EksCluster");
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
      props.baseStack.xrayAddOnStack.xrayServiceDNSAndPort;

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

    if (fulfillmentDockerImageAsset) {
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
        }
      );
      fulfillmentAdvancedTierStack.node.addDependency(
        tenantSpecificAdvancedTierNamespace
      );
    }

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
      }
    );
  }
}
