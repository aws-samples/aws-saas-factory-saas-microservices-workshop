import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";
import { ApplicationAdvancedTierStackProps } from "../interface/application-advanced-tier-props";
import { FulfillmentAdvancedTierStack } from "../fulfillment/infrastructure/fulfillment-advanced-tier-stack";
import { OrderAdvancedTierStack } from "../order/infrastructure/order-advanced-tier-stack";
import { ProductAdvancedTierStack } from "../product/infrastructure/product-advanced-tier-stack";
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

    const region = props.env?.region;
    const account = props.env?.account;
    const tier = Tier.Advanced;
    const tenantId = props.tenantId;
    const clusterInfo = props.baseStack.eksStack.clusterInfo;
    const xrayServiceDNSAndPort =
      props.baseStack.xrayAddOnStack.xrayServiceDNSAndPort;
    const istioIngressGateway = props.baseStack.istioStack.istioIngressGateway;
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

    const cluster = eks.Cluster.fromClusterAttributes(this, "ImportedCluster", {
      clusterName: clusterInfo.cluster.clusterName,
      clusterSecurityGroupId: clusterInfo.cluster.clusterSecurityGroupId,
      kubectlLambdaRole: clusterInfo.cluster.kubectlLambdaRole,
      kubectlEnvironment: clusterInfo.cluster.kubectlEnvironment,
      kubectlLayer: clusterInfo.cluster.kubectlLayer,
      awscliLayer: clusterInfo.cluster.awscliLayer,
      kubectlRoleArn: clusterInfo.cluster.kubectlRole?.roleArn,
      openIdConnectProvider: clusterInfo.cluster.openIdConnectProvider,
    });

    const productAdvancedTierStack = new ProductAdvancedTierStack(
      this,
      "productAdvancedTierStack",
      {
        clusterInfo: clusterInfo,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        istioIngressGateway: istioIngressGateway,
        productServiceDNS: productServiceDNS,
        productServicePort: productServicePort,
        namespace: namespace,
        tier: tier,
        tenantId: tenantId,
        env: { account, region },
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
        clusterInfo: clusterInfo,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        istioIngressGateway: istioIngressGateway,
        fulfillmentServiceDNS: fulfillmentServiceDNS,
        fulfillmentServiceDNSPort: fulfillmentServicePort,
        fulfillmentDockerImageAsset: fulfillmentDockerImageAsset,
        sideCarImageAsset: sideCarImageAsset,
        namespace: tenantSpecificAdvancedTierNamespaceName,
        tier: tier,
        tenantId: tenantId,
        env: { account, region },
      }
    );

    fulfillmentAdvancedTierStack.node.addDependency(
      tenantSpecificAdvancedTierNamespace
    );

    const orderAdvancedTierStack = new OrderAdvancedTierStack(
      this,
      "orderAdvancedTierStack",
      {
        clusterInfo: clusterInfo,
        xrayServiceDNSAndPort: xrayServiceDNSAndPort,
        istioIngressGateway: istioIngressGateway,
        orderServiceDNS: orderServiceDNS,
        orderServicePort: orderServicePort,
        namespace: namespace,
        tier: tier,
        tenantId: tenantId,
        env: { account, region },
      }
    );
  }
}
