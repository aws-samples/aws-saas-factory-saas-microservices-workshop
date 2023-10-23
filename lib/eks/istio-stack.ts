import { Construct } from "constructs";
import { IstioAddOnStackProps } from "../interface/istio-addon-props";

export class IstioResources extends Construct {
  public readonly istioIngressGateway: string;

  constructor(scope: Construct, id: string, props: IstioAddOnStackProps) {
    super(scope, id);

    const cluster = props.cluster;
    const issuer = props.issuer;
    const jwksUri = props.jwksUri;
    const tlsCert = props.tlsCert;
    const tlsKey = props.tlsKey;

    const istioHelmRepo = "https://istio-release.storage.googleapis.com/charts";
    const istioVersion = "1.18.1";
    const istioSystemNamespaceName = "istio-system";
    const istioIngressNamespaceName = "istio-ingress";
    const ingressGatewayName = "gateway";
    const tlsSecretName = "istio-gateway-tls-secret";

    this.istioIngressGateway = `${istioIngressNamespaceName}/${ingressGatewayName}`;

    const istioIngressNamespace = cluster.addManifest(
      "my-istio-ingress-namespace",
      {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
          name: istioIngressNamespaceName,
          labels: { "istio-injection": "enabled" },
        },
      }
    );

    cluster.addManifest("jwt-req-authn", {
      apiVersion: "security.istio.io/v1beta1",
      kind: "RequestAuthentication",
      metadata: {
        name: "jwt-on-ingress",
        namespace: istioSystemNamespaceName,
      },
      spec: {
        selector: {
          matchLabels: {
            istio: "ingress",
          },
        },
        jwtRules: [
          {
            issuer: issuer,
            jwksUri: jwksUri,
            forwardOriginalToken: true,
            outputClaimToHeaders: [ // todo: decide if we want to keep this or remove it
              {
                header: "x-jwt-tenant-id",
                claim: "custom:tenant_id",
              },
              {
                header: "x-jwt-tenant-tier",
                claim: "custom:tenant_tier",
              },
            ],
          },
        ],
      },
    });

    const istioIngress = cluster.addHelmChart("istio-ingress", {
      release: "istio-ingress",
      namespace: istioIngressNamespaceName,
      chart: "gateway",
      version: istioVersion,
      repository: istioHelmRepo,
      values: {
        service: {
          annotations: {
            "service.beta.kubernetes.io/aws-load-balancer-healthcheck-path":
              "/health",
            "service.beta.kubernetes.io/aws-load-balancer-type": "nlb",
            "service.beta.kubernetes.io/aws-load-balancer-proxy-protocol": "*",
          },
        },
      },
    });

    istioIngress.node.addDependency(istioIngressNamespace);

    const tlsSecret = cluster.addManifest("my-tls-secret", {
      apiVersion: "v1",
      data: {
        "tls.crt": tlsCert,
        "tls.key": tlsKey,
      },
      kind: "Secret",
      metadata: {
        name: tlsSecretName,
        namespace: istioIngressNamespaceName,
      },
      type: "kubernetes.io/tls",
    });

    tlsSecret.node.addDependency(istioIngressNamespace);

    const ingressGateway = cluster.addManifest("ingress-gateway", {
      apiVersion: "networking.istio.io/v1alpha3",
      kind: "Gateway",
      metadata: {
        name: ingressGatewayName,
        namespace: istioIngressNamespaceName,
      },
      spec: {
        selector: {
          istio: "ingress",
        },
        servers: [
          {
            port: {
              number: 80,
              name: "http",
              protocol: "HTTP",
            },
            hosts: ["*/*"],
            tls: {
              httpsRedirect: true,
            },
          },
          {
            port: {
              number: 443,
              name: "https",
              protocol: "HTTPS",
            },
            tls: {
              mode: "SIMPLE",
              credentialName: tlsSecretName,
              minProtocolVersion: "TLSV1_2",
              maxProtocolVersion: "TLSV1_3",
            },
            hosts: ["*/*"],
          },
        ],
      },
    });

    ingressGateway.node.addDependency(istioIngress);
    ingressGateway.node.addDependency(tlsSecret);
    ingressGateway.node.addDependency(istioIngressNamespace);
  }
}
