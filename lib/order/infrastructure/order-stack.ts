// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { OrderMicroserviceStackProps } from "../../interface/order-microservice-props";
import { MicroserviceStack } from "../../abstract-class/microservice-stack";

var path = require("path");

export class OrderStack extends MicroserviceStack {
  public readonly orderServiceDNS: string;
  public readonly orderServicePort: number;
  public readonly orderDockerImageAsset: DockerImageAsset;
  public readonly serviceName: string = "order";
  constructor(
    scope: Construct,
    id: string,
    props: OrderMicroserviceStackProps
  ) {
    super(scope, id, props);

    const cluster = props.cluster;
    const istioIngressGateway = props.istioIngressGateway;
    const fulfillmentServiceDNS = props.fulfillmentServiceDNS;    
    const baseImage = props.baseImage;

    const tenantTier = props.tenantTier;
    const tenantId = props.tenantId;
    const namespace = props.namespace; // from the ApplicationStack
    const multiTenantLabels = {
      tenantTier: tenantTier,
      ...(tenantId && { tenantId: tenantId }),
    };

    if (props.applicationImageAsset) {
      this.orderDockerImageAsset = props.applicationImageAsset;
    } else {
      const image = new DockerImageAsset(
        this,
        "saas-microservices-order-image",
        {
          directory: path.join(__dirname, "../app"),
          ...(baseImage && {
            buildArgs: {
              BASE_IMAGE: baseImage,
            },
          }),
        }
      );
      new cdk.CfnOutput(this, "image", {
        value: image.imageUri,
      });
      this.orderDockerImageAsset = image;
    }

    const orderTable = new dynamodb.Table(this, "OrderTable", {
      partitionKey: { name: "tenantId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "orderId", type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
      billingMode: dynamodb.BillingMode.PROVISIONED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: `SaaSMicroservices-Orders-${namespace}`,
    });

    const orderServiceAccount = cluster.addServiceAccount(
      "OrderServiceAccount",
      {
        name: "order-service-account",
        namespace: namespace,
      }
    );
    
    orderServiceAccount.node.children.forEach((child) => {   // ensure that namespace is created before orderServiceAccount
      if (props.namespaceConstruct) {
        child.node.addDependency(props.namespaceConstruct);
      }
    });

    const accessRole = new iam.Role(this, "access-role", {
      assumedBy: orderServiceAccount.role.grantPrincipal,
    });
    const stringLikeConditionKey = `aws:RequestTag/TenantID`;
    accessRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        principals: [orderServiceAccount.role.grantPrincipal],
        actions: ["sts:TagSession"],
        conditions: {
          StringLike: {
            [stringLikeConditionKey]: "*",
          },
        },
      })
    );
    accessRole.attachInlinePolicy(
      new iam.Policy(this, "OrderAccessPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["dynamodb:query", "dynamodb:PutItem"],
            resources: [orderTable.tableArn],
            conditions: {
              "ForAllValues:StringLike": {
                "dynamodb:LeadingKeys": [`\${aws:PrincipalTag/TenantID}`],
              },
            },
          }),
        ],
      })
    );

    const orderDeployment = cluster.addManifest("OrderDeployment", {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "order-app",
        namespace: namespace,
        labels: {
          ...multiTenantLabels,
        },
      },
      spec: {
        selector: {
          matchLabels: {
            app: "order-app",
          },
        },
        replicas: 1,
        template: {
          metadata: {
            labels: {
              app: "order-app",
              // authorization: "enabled",
              ...multiTenantLabels,
            },
          },
          spec: {
            serviceAccountName: orderServiceAccount.serviceAccountName,
            containers: [
              {
                name: "order-app",
                image: this.orderDockerImageAsset.imageUri,
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
                    path: "/orders/health",
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
                    path: "/orders/health",
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
                    value: orderTable.tableName,
                  },
                  {
                    name: "FULFILLMENT_ENDPOINT",
                    value: fulfillmentServiceDNS,
                  },
                ]),
                ports: [
                  {
                    containerPort: 8080,
                    name: "order-app",
                  },
                ],
              },
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
                    value: "Order",
                  },
                ]),
                ports: [
                  {
                    containerPort: 8081,
                    name: "sidecar-app",
                  },
                ],
              },
            ],
          },
        },
      },
    });
    orderDeployment.node.addDependency(orderServiceAccount);

    const orderService = cluster.addManifest("OrderService", {
      kind: "Service",
      apiVersion: "v1",
      metadata: {
        name: "order-service",
        namespace: namespace,
        labels: {
          ...multiTenantLabels,
        },
      },
      spec: {
        selector: {
          app: "order-app",
        },
        ports: [
          {
            port: 80,
            targetPort: 8080,
          },
        ],
      },
    });
    orderService.node.addDependency(orderDeployment);

    this.orderServicePort = 80;
    this.orderServiceDNS = `order-service.${namespace}.svc.cluster.local`;

    const orderVirtualService = cluster.addManifest("OrderVirtualService", {
      apiVersion: "networking.istio.io/v1alpha3",
      kind: "VirtualService",
      metadata: {
        name: "order-vs",
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
                  host: this.orderServiceDNS,
                  port: {
                    number: this.orderServicePort,
                  },
                },
              },
            ],
          },
        ],
      },
    });
    orderVirtualService.node.addDependency(orderService);
  }
}
