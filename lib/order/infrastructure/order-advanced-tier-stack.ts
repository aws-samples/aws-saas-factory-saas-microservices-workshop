import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";
import { OrderMicroserviceAdvancedTierStackProps } from "../../interface/order-microservice-advanced-tier-props";

export class OrderAdvancedTierStack extends cdk.NestedStack {
  constructor(
    scope: Construct,
    id: string,
    props: OrderMicroserviceAdvancedTierStackProps
  ) {
    super(scope, id, props);

    const clusterInfo = props.clusterInfo;
    const istioIngressGateway = props.istioIngressGateway;
    const orderServiceDNS = props.orderServiceDNS;
    const orderServicePort = props.orderServicePort;

    const tier = props.tier;
    const tenantId = props.tenantId;
    const namespace = props.namespace; // from the ApplicationStack
    const multiTenantLabels = {
      tier: tier,
      ...(tenantId && { tenantId: tenantId }),
    };

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

    cluster.addManifest("order-virtual-service", {
      apiVersion: "networking.istio.io/v1alpha3",
      kind: "VirtualService",
      metadata: {
        name: "order-virtual-service",
        namespace: namespace,
        labels: {
          ...multiTenantLabels,
        },
      },
      spec: {
        hosts: ["saas-workshop.example.com"],
        gateways: [istioIngressGateway],
        http: [
          {
            name: namespace.substring(0, 14),
            match: [
              {
                uri: {
                  prefix: "/orders",
                },
                headers: {
                  "@request.auth.claims.custom:tenant_tier": {
                    regex: tier,
                  },
                  "@request.auth.claims.custom:tenant_id": {
                    regex: tenantId,
                  },
                },
              },
            ],
            route: [
              {
                destination: {
                  host: orderServiceDNS,
                  port: {
                    number: orderServicePort,
                  },
                },
              },
            ],
          },
        ],
      },
    });
  }
}
