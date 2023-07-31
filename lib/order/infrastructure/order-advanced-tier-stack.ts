import { Construct } from "constructs";
import { OrderMicroserviceAdvancedTierStackProps } from "../../interface/order-microservice-advanced-tier-props";

export class OrderAdvancedTierStack extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: OrderMicroserviceAdvancedTierStackProps
  ) {
    super(scope, id);

    const cluster = props.cluster;
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
