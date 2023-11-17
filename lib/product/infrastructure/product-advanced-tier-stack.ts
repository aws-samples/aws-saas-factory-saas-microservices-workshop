// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Construct } from "constructs";
import { ProductMicroserviceAdvancedTierStackProps } from "../../interface/product-microservice-advanced-tier-props";

export class ProductAdvancedTierStack extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ProductMicroserviceAdvancedTierStackProps
  ) {
    super(scope, id);

    const cluster = props.cluster;
    const istioIngressGateway = props.istioIngressGateway;
    const productServiceDNS = props.productServiceDNS;
    const productServicePort = props.productServicePort;
    const tenantId = props.tenantId;
    const tenantTier = props.tenantTier;

    const productVirtualService = cluster.addManifest(
      "product-virtual-service",
      {
        apiVersion: "networking.istio.io/v1alpha3",
        kind: "VirtualService",
        metadata: {
          name: `${tenantId}-product-vs`.substring(0, 14),
          namespace: props?.namespace,
          labels: {
            tenantTier: tenantTier,
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
              name: `${tenantId}-${tenantTier}`.substring(0, 14),
              match: [
                {
                  uri: {
                    prefix: "/products",
                  },
                  headers: {
                    "@request.auth.claims.custom:tenant_tier": {
                      regex: tenantTier,
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
