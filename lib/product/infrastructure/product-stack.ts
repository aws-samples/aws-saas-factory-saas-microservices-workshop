// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { MicroserviceStackProps } from "../../interface/microservice-props";
import { MicroserviceStack } from "../../abstract-class/microservice-stack";

var path = require("path");

export class ProductStack extends MicroserviceStack {
  public readonly productServiceDNS: string;
  public readonly productServicePort: number;
  public readonly productImageAsset: DockerImageAsset;
  public readonly serviceName: string = "product";
  constructor(scope: Construct, id: string, props: MicroserviceStackProps) {
    super(scope, id, props);

    const istioIngressGateway = props.istioIngressGateway;
    const baseImage = props.baseImage;

    // REPLACE START: LAB1 (namespace)
    const namespace = "default";
    const multiTenantLabels = {};
    // REPLACE END: LAB1 (namespace)

    cdk.Tags.of(this).add("SaaS-Microservices:ServiceName", this.serviceName);
    // PASTE: LAB1(tenant context tags)

    // REPLACE START: LAB1 (product table)
    const productTable = new dynamodb.Table(this, "ProductTable", {
      partitionKey: { name: "productId", type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
      billingMode: dynamodb.BillingMode.PROVISIONED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: `SaaSMicroservices-Products`,
    });
    // REPLACE END: LAB1 (product table)

    if (props.applicationImageAsset) {
      this.productImageAsset = props.applicationImageAsset;
    } else {
      const productImage = new DockerImageAsset(
        this,
        "ProductAppContainerImage",
        {
          directory: path.join(__dirname, "../app"),
          ...(baseImage && {
            buildArgs: {
              BASE_IMAGE: baseImage,  // baseImage assigned from process.env.HELPER_LIBRARY_BASE_IMAGE
            },
          }),
        }
      );
      new cdk.CfnOutput(this, "productImage", {
        value: productImage.imageUri,
      });
      this.productImageAsset = productImage;
    }

    const cluster = props.cluster;

    const productServiceAccount = cluster.addServiceAccount(
      `ProductServiceAccount`,
      {
        name: "product-service-account",
        namespace: namespace,
      }
    );
    
    productServiceAccount.node.children.forEach((child) => {   // ensure that namespace is created before productServiceAccount
      if (props.namespaceConstruct) {
        child.node.addDependency(props.namespaceConstruct);
      }
    });

    // REPLACE START: LAB2 (IAM resources)
    productServiceAccount.role.attachInlinePolicy(
      new iam.Policy(this, "ProductServicePolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["dynamodb:query", "dynamodb:PutItem"],
            resources: [productTable.tableArn],
          }),
        ],
      })
    );
    // REPLACE END: LAB2 (IAM resources)


    // PASTE: LAB5 (IAM permissions to access policy store)


    const productDeployment = cluster.addManifest(`ProductDeployment`, {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "product-app",
        namespace: namespace,
        labels: {
          ...multiTenantLabels,
        },
      },
      spec: {
        selector: {
          matchLabels: {
            app: "product-app",
          },
        },
        replicas: 1,
        template: {
          metadata: {
            /* // REMOVE THIS LINE: LAB2 (annotation)
            annotations: {
              "eks.amazonaws.com/skip-containers": "product-app",
            },
            */ // REMOVE THIS LINE: LAB2 (annotation)
            labels: {
              app: "product-app",
              // UNCOMMENT: LAB5 (uncomment the line below)
              // authorization: "enabled",
              ...multiTenantLabels,
            },
          },
          spec: {
            serviceAccountName: productServiceAccount.serviceAccountName,
            containers: [
              {
                name: "product-app",
                image: this.productImageAsset.imageUri,
                resources: {
                  requests: {
                    cpu: "100m",
                    memory: "250Mi",
                  },
                  limits: {
                    cpu: "150m",
                    memory: "300Mi",
                  },
                },
                livenessProbe: {
                  httpGet: {
                    path: "/products/health",
                    port: 8080,
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                  successThreshold: 1,
                  failureThreshold: 3,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/products/health",
                    port: 8080,
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 2,
                  successThreshold: 1,
                  failureThreshold: 3,
                  periodSeconds: 10,
                },
                env: this.combineWithBaseContainerEnvs([
                  {
                    name: "TOKEN_VENDOR_ENDPOINT_PORT",
                    value: "8081",
                  },
                  {
                    name: "TABLE_NAME",
                    value: productTable.tableName,
                  },
                ]),
                ports: [
                  {
                    containerPort: 8080,
                    name: "product-app",
                  },
                ],
              },
              /* // REMOVE THIS LINE: LAB2 (sidecar app)
              {
                name: "sidecar-app",
                image: props.sideCarImageAsset?.imageUri,
                resources: {
                  requests: {
                    cpu: "100m",
                    memory: "100Mi",
                  },
                  limits: {
                    cpu: "100m",
                    memory: "100Mi",
                  },
                },
                livenessProbe: {
                  exec: {
                    command: ["curl", "--fail", `127.0.0.1:8081/health`],
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                  successThreshold: 1,
                  failureThreshold: 3,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  exec: {
                    command: ["curl", "--fail", `127.0.0.1:8081/health`],
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 2,
                  successThreshold: 1,
                  failureThreshold: 3,
                  periodSeconds: 10,
                },
                env: this.combineWithBaseContainerEnvs([
                  {
                    name: "ROLE_ARN",
                    value: accessRole.roleArn,
                  },
                  {
                    name: "TOKEN_VENDOR_ENDPOINT_PORT",
                    value: "8081",
                  },
                  {
                    name: "TENANT_TAG_KEY",
                    value: "TenantID",
                  },
                  {
                    name: "AUTH_RESOURCE",
                    value: "Product",
                  },
                  // PASTE: LAB5 (add policy store reference to sidecar)
                ]),
                ports: [
                  {
                    containerPort: 8081,
                    name: "sidecar-app",
                  },
                ],
              },
              */ // REMOVE THIS LINE: LAB2 (sidecar app)
            ],
          },
        },
      },
    });
    productDeployment.node.addDependency(productServiceAccount);

    this.productServicePort = 80;
    this.productServiceDNS = `product-service.${namespace}.svc.cluster.local`;

    const productService = cluster.addManifest(`ProductService`, {
      kind: "Service",
      apiVersion: "v1",
      metadata: {
        name: "product-service",
        namespace: namespace,
        labels: {
          ...multiTenantLabels,
        },
      },
      spec: {
        selector: {
          app: "product-app",
        },
        ports: [
          {
            port: this.productServicePort,
            targetPort: 8080,
          },
        ],
      },
    });
    productService.node.addDependency(productDeployment);

    const productVirtualService = cluster.addManifest(`ProductVirtualService`, {
      apiVersion: "networking.istio.io/v1alpha3",
      kind: "VirtualService",
      metadata: {
        name: "product-vs",
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
                  prefix: "/products",
                },
                /* // LAB4: REMOVE THIS LINE (routing)
                headers: {
                  "@request.auth.claims.custom:tenant_tier": {
                    regex: tenantTier,
                  },
                  ...(tenantId && {
                    "@request.auth.claims.custom:tenant_id": {
                      regex: tenantId,
                    },
                  }),
                },
                */ // LAB4: REMOVE THIS LINE (routing)
              },
            ],
            route: [
              {
                destination: {
                  host: this.productServiceDNS,
                  port: {
                    number: this.productServicePort,
                  },
                },
              },
            ],
          },
        ],
      },
    });
    productVirtualService.node.addDependency(productService);
  }
}
