import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";
import { ProductMicroserviceAdvancedTierStackProps } from "../../interface/product-microservice-advanced-tier-props";

export class ProductAdvancedTierStack extends cdk.NestedStack {
  constructor(
    scope: Construct,
    id: string,
    props: ProductMicroserviceAdvancedTierStackProps
  ) {
    super(scope, id, props);

    const region = props.env?.region;
    const clusterInfo = props.clusterInfo;
    const xrayServiceDNSAndPort = props.xrayServiceDNSAndPort;
    const istioIngressGateway = props.istioIngressGateway;
    const productServiceDNS = props.productServiceDNS;
    const productServicePort = props.productServicePort;
    const tenantId = props.tenantId;
    const tier = props.tier;

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

    const productVirtualService = cluster.addManifest(
      "product-virtual-service",
      {
        apiVersion: "networking.istio.io/v1alpha3",
        kind: "VirtualService",
        metadata: {
          name: `pro-${tier}`,
          namespace: props?.namespace,
          labels: {
            tier: tier,
            ...(tenantId && {
              tenantId: tenantId,
            }),
          },
        },
        spec: {
          hosts: ["saas-workshop.example.com"],
          gateways: [istioIngressGateway],
          http: [
            {
              name: tenantId
                ? `${tenantId}-${tier}`.substring(0, 14)
                : `${tier}`.substring(0, 14),
              match: [
                {
                  uri: {
                    prefix: "/products",
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
                    host: productServiceDNS,
                    port: {
                      number: productServicePort,
                    },
                  },
                },
              ],
            },
          ],
        },
      }
    );
  }
}
