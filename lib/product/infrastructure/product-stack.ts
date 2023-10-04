import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { MicroserviceStackProps } from "../../interface/microservice-props";

var path = require("path");

export class ProductStack extends Construct {
  public readonly productServiceDNS: string;
  public readonly productServicePort: number;
  public readonly productImageAsset: DockerImageAsset;
  constructor(scope: Construct, id: string, props: MicroserviceStackProps) {
    super(scope, id);

    const istioIngressGateway = props.istioIngressGateway;
    const xrayServiceName = "ProductService";
    const xrayServiceDNSAndPort = props.xrayServiceDNSAndPort;
    const cloudwatchAgentLogEndpoint = props.cloudwatchAgentLogEndpoint;
    const cloudwatchAgentLogGroupName = props.cloudwatchAgentLogGroupName;
    const baseImageSSMParameterName = "";
    const baseImage = baseImageSSMParameterName
      ? ssm.StringParameter.valueFromLookup(this, baseImageSSMParameterName)
      : "public.ecr.aws/docker/library/python:3.9.14-slim-bullseye";

    // REPLACE START: LAB1 (namespace)
    const namespace = "default";
    const multiTenantLabels = {};
    // REPLACE END: LAB1 (namespace)

    // PASTE: LAB1(tenant context tags)
    cdk.Tags.of(this).add("SaaS-Microservices:ServiceName", "Product");

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
          buildArgs: {
            BASE_IMAGE: baseImage,
          },
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
    // ensure that namespace is created before productServiceAccount
    productServiceAccount.node.children.forEach((child) => {
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
              "eks.amazonaws.com/skip-containers": "product-app"
            },
            */ // REMOVE THIS LINE: LAB2 (annotation)
            labels: {
              app: "product-app",
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
                env: [
                  {
                    name: "TOKEN_VENDOR_ENDPOINT_PORT",
                    value: "8081",
                  },
                  {
                    name: "TABLE_NAME",
                    value: productTable.tableName,
                  },
                  {
                    name: "AWS_DEFAULT_REGION",
                    value: cdk.Stack.of(this).region,
                  },
                  {
                    name: "AWS_XRAY_DAEMON_ADDRESS",
                    value: xrayServiceDNSAndPort,
                  },
                  {
                    name: "AWS_EMF_AGENT_ENDPOINT",
                    value: cloudwatchAgentLogEndpoint,
                  },
                  {
                    name: "AWS_EMF_LOG_GROUP_NAME",
                    value: cloudwatchAgentLogGroupName,
                  },
                  {
                    name: "AWS_EMF_LOG_STREAM_NAME",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.name",
                      },
                    },
                  },
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                  {
                    name: "AWS_XRAY_SERVICE_NAME",
                    value: xrayServiceName,
                  },
                ],
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
                env: [
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
                    name: "AWS_DEFAULT_REGION",
                    value: cdk.Stack.of(this).region,
                  },
                  {
                    name: "AWS_XRAY_DAEMON_ADDRESS",
                    value: xrayServiceDNSAndPort,
                  },
                  {
                    name: "AWS_EMF_AGENT_ENDPOINT",
                    value: cloudwatchAgentLogEndpoint,
                  },
                  {
                    name: "AWS_EMF_LOG_GROUP_NAME",
                    value: cloudwatchAgentLogGroupName,
                  },
                  {
                    name: "AWS_EMF_LOG_STREAM_NAME",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.name",
                      },
                    },
                  },
                  {
                    name: "AWS_XRAY_SERVICE_NAME",
                    value: xrayServiceName,
                  },
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
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
                    regex: tier,
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
