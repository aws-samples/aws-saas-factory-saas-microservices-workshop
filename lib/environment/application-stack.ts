import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";
import { ProductStack } from "../product/infrastructure/product-stack";
import { FulfillmentStack } from "../fulfillment/infrastructure/fulfillment-stack";
import { ApplicationStackProps } from "../interface/application-props";
import { OrderStack } from "../order/infrastructure/order-stack";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Tier } from "../enums/tier";

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

    const deploymentMode = new cdk.CfnParameter(this, "mode", {
      type: "String",
      minLength: 0,
      allowedValues: ["", "all", "product"],
      default: "all",
    }).valueAsString;

    const deployModeCondition = new cdk.CfnCondition(
      this,
      "DeployModeCondition",
      {
        expression: cdk.Fn.conditionEquals(deploymentMode, "all"),
      }
    );

    const clusterInfo = props.baseStack.eksStack.clusterInfo;
    const xrayServiceDNSAndPort =
      props.baseStack.xrayAddOnStack.xrayServiceDNSAndPort;
    const istioIngressGateway = props.baseStack.istioStack.istioIngressGateway;

    const region = props.env?.region;
    const account = props.env?.account;
    const tier = props.tier;
    const tenantId = props.tenantId;
    const sideCarImageAsset = props.sideCarImageAsset;

    if (tier != Tier.Basic && tier != Tier.Premium) {
      throw new Error(`Tier: "${tier}" not supported!`);
    }

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

    // Application environment kubernetes namespace
    this.namespace = tenantId ? `${tenantId}` : `${tier}-pool`;

    const stackNamespace = cluster.addManifest("StackNamespaceManifest", {
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

    const productStack = new ProductStack(this, "ProductStack", {
      clusterInfo: clusterInfo,
      xrayServiceDNSAndPort: xrayServiceDNSAndPort,
      istioIngressGateway: istioIngressGateway,
      applicationImageAsset: props.basicStack?.productDockerImageAsset,
      sideCarImageAsset: sideCarImageAsset,
      namespace: this.namespace,
      tier: tier,
      tenantId: tenantId,
      env: { account, region },
    });
    productStack.node.addDependency(stackNamespace);
    this.productServiceDNS = productStack.productServiceDNS;
    this.productServicePort = productStack.productServicePort;
    this.productDockerImageAsset = productStack.productImageAsset;

    const fulfillmentStack = new FulfillmentStack(this, "fulfillmentStack", {
      clusterInfo: clusterInfo,
      xrayServiceDNSAndPort: xrayServiceDNSAndPort,
      istioIngressGateway: istioIngressGateway,
      applicationImageAsset: props.basicStack?.fulfillmentDockerImageAsset,
      sideCarImageAsset: sideCarImageAsset,
      namespace: this.namespace,
      tier: tier,
      tenantId: tenantId,
      env: { account, region },
    });
    fulfillmentStack.node.addDependency(stackNamespace);
    this.fulfillmentServicePort = fulfillmentStack.fulfillmentServicePort;
    this.fulfillmentDockerImageAsset =
      fulfillmentStack.fulfillmentDockerImageAsset;
    this.fulfillmentServiceDNS = fulfillmentStack.fulfillmentServiceDNS;
    (fulfillmentStack.node.defaultChild as cdk.CfnStack).cfnOptions.condition =
      deployModeCondition;

    const orderStack = new OrderStack(this, "orderStack", {
      clusterInfo: clusterInfo,
      xrayServiceDNSAndPort: xrayServiceDNSAndPort,
      istioIngressGateway: istioIngressGateway,
      namespace: this.namespace,
      fulfillmentServiceDNS: fulfillmentStack.fulfillmentServiceDNS,
      fulfillmentServicePort: fulfillmentStack.fulfillmentServicePort,
      applicationImageAsset: props.basicStack?.orderDockerImageAsset,
      sideCarImageAsset: sideCarImageAsset,
      tier: tier,
      tenantId: tenantId,
      env: { account, region },
    });
    orderStack.node.addDependency(stackNamespace);
    this.orderServiceDNS = orderStack.orderServiceDNS;
    this.orderServicePort = orderStack.orderServicePort;
    this.orderDockerImageAsset = orderStack.orderDockerImageAsset;
    (orderStack.node.defaultChild as cdk.CfnStack).cfnOptions.condition =
      deployModeCondition;
  }
}
