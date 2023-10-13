import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { InvoiceMicroserviceStackProps } from "../../interface/invoice-microservice-props";

var path = require("path");

export class InvoiceStack extends Construct {
  public readonly invoiceImageAsset: DockerImageAsset;
  constructor(
    scope: Construct,
    id: string,
    props: InvoiceMicroserviceStackProps
  ) {
    super(scope, id);

    const workshopSSMPrefix = "/saas-workshop";

    const fulfillmentQueueURL = props.fulfillmentQueue.queueUrl;
    const fulfillmentQueueArn = props.fulfillmentQueue.queueArn;
    const productServiceDNS = props.productServiceDNS;
    const xrayServiceName = "InvoiceService";
    const xrayServiceDNSAndPort = props.xrayServiceDNSAndPort;
    const cloudwatchAgentLogEndpoint = props.cloudwatchAgentLogEndpoint;
    const cloudwatchAgentLogGroupName = props.cloudwatchAgentLogGroupName;
    const baseImageSSMParameterName = `${workshopSSMPrefix}/sharedImageUri`;
    const baseImage = baseImageSSMParameterName
      ? ssm.StringParameter.valueFromLookup(this, baseImageSSMParameterName)
      : "public.ecr.aws/docker/library/python:3.9.14-slim-bullseye";

    const tier = props.tier;
    const tenantId = props.tenantId;
    const namespace = props.namespace; // from the ApplicationStack
    const multiTenantLabels = {
      tier: tier,
      ...(tenantId && { tenantId: tenantId }),
    };

    // PASTE: LAB1(tenant context tags)
    cdk.Tags.of(this).add("SaaS-Microservices:ServiceName", "Invoice");

    // const invoiceTable = new dynamodb.Table(this, "InvoiceTable", {
    //   partitionKey: { name: "tenantId", type: dynamodb.AttributeType.STRING }, // tenant-id partition key
    //   sortKey: { name: "invoiceId", type: dynamodb.AttributeType.STRING },
    //   readCapacity: 5,
    //   writeCapacity: 5,
    //   billingMode: dynamodb.BillingMode.PROVISIONED,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    //   tableName: `SaaSMicroservices-Invoices-${namespace}`, // namespace appended to the table name
    // });

    if (props.applicationImageAsset) {
      this.invoiceImageAsset = props.applicationImageAsset;
    } else {
      const invoiceImage = new DockerImageAsset(
        this,
        "InvoiceAppContainerImage",
        {
          directory: path.join(__dirname, "../app"),
          buildArgs: {
            BASE_IMAGE: baseImage,
          },
        }
      );
      new cdk.CfnOutput(this, "invoiceImage", {
        value: invoiceImage.imageUri,
      });
      this.invoiceImageAsset = invoiceImage;
    }

    const cluster = props.cluster;

    const invoiceServiceAccount = cluster.addServiceAccount(
      `InvoiceServiceAccount`,
      {
        name: `${namespace}-invoice-service-account`,
        namespace: namespace,
      }
    );

    invoiceServiceAccount.node.children.forEach((child) => {
      if (props.namespaceConstruct) {
        child.node.addDependency(props.namespaceConstruct);
      }
    });

    invoiceServiceAccount.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage"],
        resources: [fulfillmentQueueArn],
      })
    );

    // const accessRole = new iam.Role(this, "access-role", {
    //   assumedBy: invoiceServiceAccount.role.grantPrincipal,
    // });

    // accessRole.assumeRolePolicy?.addStatements(
    //   new iam.PolicyStatement({
    //     principals: [invoiceServiceAccount.role.grantPrincipal],
    //     actions: ["sts:TagSession"],
    //     conditions: {
    //       StringLike: { [`aws:RequestTag/TenantID`]: "*" },
    //     },
    //   })
    // );

    // accessRole.attachInlinePolicy(
    //   new iam.Policy(this, "InvoiceServiceAccessPolicy", {
    //     statements: [
    //       new iam.PolicyStatement({
    //         actions: ["dynamodb:query", "dynamodb:PutItem"],
    //         resources: [invoiceTable.tableArn],
    //         conditions: {
    //           "ForAllValues:StringLike": {
    //             "dynamodb:LeadingKeys": [`\${aws:PrincipalTag/TenantID}`],
    //           },
    //         },
    //       }),
    //     ],
    //   })
    // );

    // const invoiceDeploymentName = `${namespace}-invoice-deployment`;
    // const invoiceDeployment = cluster.addManifest(`InvoiceDeployment`, {
    //   apiVersion: "apps/v1",
    //   kind: "Deployment",
    //   metadata: {
    //     name: invoiceDeploymentName,
    //     namespace: namespace,
    //     labels: {
    //       ...multiTenantLabels,
    //     },
    //   },
    //   spec: {
    //     selector: {
    //       matchLabels: {
    //         app: "invoice-app",
    //       },
    //     },
    //     replicas: 0,
    //     template: {
    //       metadata: {
    //         // annotations: {
    //         //   "eks.amazonaws.com/skip-containers": "invoice-app",
    //         // },
    //         labels: {
    //           app: "invoice-app",
    //           ...multiTenantLabels,
    //         },
    //       },
    //       spec: {
    //         serviceAccountName: invoiceServiceAccount.serviceAccountName,
    //         containers: [
    //           {
    //             name: "invoice-app",
    //             image: this.invoiceImageAsset.imageUri,
    //             resources: {
    //               requests: {
    //                 cpu: "100m",
    //                 memory: "250Mi",
    //               },
    //               limits: {
    //                 cpu: "150m",
    //                 memory: "300Mi",
    //               },
    //             },
    //             env: [
    //               // {
    //               //   name: "TOKEN_VENDOR_ENDPOINT_PORT",
    //               //   value: "8081",
    //               // },
    //               // {
    //               //   name: "TABLE_NAME",
    //               //   value: invoiceTable.tableName,
    //               // },
    //               {
    //                 name: "PRODUCT_ENDPOINT",
    //                 value: productServiceDNS,
    //               },
    //               {
    //                 name: "QUEUE_URL",
    //                 value: fulfillmentQueueURL,
    //               },
    //               {
    //                 name: "AWS_DEFAULT_REGION",
    //                 value: cdk.Stack.of(this).region,
    //               },
    //               {
    //                 name: "AWS_XRAY_DAEMON_ADDRESS",
    //                 value: xrayServiceDNSAndPort,
    //               },
    //               {
    //                 name: "AWS_EMF_AGENT_ENDPOINT",
    //                 value: cloudwatchAgentLogEndpoint,
    //               },
    //               {
    //                 name: "AWS_EMF_LOG_GROUP_NAME",
    //                 value: cloudwatchAgentLogGroupName,
    //               },
    //               {
    //                 name: "AWS_EMF_LOG_STREAM_NAME",
    //                 valueFrom: {
    //                   fieldRef: {
    //                     fieldPath: "metadata.name",
    //                   },
    //                 },
    //               },
    //               {
    //                 name: "POD_NAMESPACE",
    //                 valueFrom: {
    //                   fieldRef: {
    //                     fieldPath: "metadata.namespace",
    //                   },
    //                 },
    //               },
    //               {
    //                 name: "AWS_XRAY_SERVICE_NAME",
    //                 value: xrayServiceName,
    //               },
    //             ],
    //             // ports: [
    //             //   {
    //             //     containerPort: 8080,
    //             //     name: "invoice-app",
    //             //   },
    //             // ],
    //           },
    //           // {
    //           //   name: "sidecar-app",
    //           //   image: props.sideCarImageAsset?.imageUri,
    //           //   resources: {
    //           //     requests: {
    //           //       cpu: "100m",
    //           //       memory: "100Mi",
    //           //     },
    //           //     limits: {
    //           //       cpu: "100m",
    //           //       memory: "100Mi",
    //           //     },
    //           //   },
    //           //   livenessProbe: {
    //           //     exec: {
    //           //       command: ["curl", "--fail", `127.0.0.1:8081/health`],
    //           //     },
    //           //     initialDelaySeconds: 5,
    //           //     timeoutSeconds: 5,
    //           //     successThreshold: 1,
    //           //     failureThreshold: 3,
    //           //     periodSeconds: 10,
    //           //   },
    //           //   readinessProbe: {
    //           //     exec: {
    //           //       command: ["curl", "--fail", `127.0.0.1:8081/health`],
    //           //     },
    //           //     initialDelaySeconds: 5,
    //           //     timeoutSeconds: 2,
    //           //     successThreshold: 1,
    //           //     failureThreshold: 3,
    //           //     periodSeconds: 10,
    //           //   },
    //           //   env: [
    //           //     {
    //           //       name: "ROLE_ARN",
    //           //       value: accessRole.roleArn,
    //           //     },
    //           //     {
    //           //       name: "TOKEN_VENDOR_ENDPOINT_PORT",
    //           //       value: "8081",
    //           //     },
    //           //     {
    //           //       name: "TENANT_TAG_KEY",
    //           //       value: "TenantID",
    //           //     },
    //           //     {
    //           //       name: "AWS_DEFAULT_REGION",
    //           //       value: cdk.Stack.of(this).region,
    //           //     },
    //           //     {
    //           //       name: "AWS_XRAY_DAEMON_ADDRESS",
    //           //       value: xrayServiceDNSAndPort,
    //           //     },
    //           //     {
    //           //       name: "AWS_EMF_AGENT_ENDPOINT",
    //           //       value: cloudwatchAgentLogEndpoint,
    //           //     },
    //           //     {
    //           //       name: "AWS_EMF_LOG_GROUP_NAME",
    //           //       value: cloudwatchAgentLogGroupName,
    //           //     },
    //           //     {
    //           //       name: "AWS_EMF_LOG_STREAM_NAME",
    //           //       valueFrom: {
    //           //         fieldRef: {
    //           //           fieldPath: "metadata.name",
    //           //         },
    //           //       },
    //           //     },
    //           //     {
    //           //       name: "AWS_XRAY_SERVICE_NAME",
    //           //       value: xrayServiceName,
    //           //     },
    //           //     {
    //           //       name: "POD_NAMESPACE",
    //           //       valueFrom: {
    //           //         fieldRef: {
    //           //           fieldPath: "metadata.namespace",
    //           //         },
    //           //       },
    //           //     },
    //           //   ],
    //           //   ports: [
    //           //     {
    //           //       containerPort: 8081,
    //           //       name: "sidecar-app",
    //           //     },
    //           //   ],
    //           // },
    //         ],
    //       },
    //     },
    //   },
    // });
    // invoiceDeployment.node.addDependency(invoiceServiceAccount);

    // const triggerAuthenticationName = `${namespace}-keda-aws-credentials`;
    // const triggerAuthentication = cluster.addManifest("TriggerAuthentication", {
    //   apiVersion: "keda.sh/v1alpha1",
    //   kind: "TriggerAuthentication",
    //   metadata: {
    //     name: triggerAuthenticationName,
    //     namespace: namespace,
    //   },
    //   spec: {
    //     podIdentity: {
    //       provider: "aws-eks",
    //     },
    //   },
    // });
    // triggerAuthentication.node.addDependency(invoiceServiceAccount);

    // const scaledObject = cluster.addManifest(`InvoiceScaledObject`, {
    //   apiVersion: "keda.sh/v1alpha1",
    //   kind: "ScaledObject",
    //   metadata: {
    //     name: `${namespace}-aws-sqs-queue-scaledobject`,
    //     namespace: namespace,
    //   },
    //   spec: {
    //     scaleTargetRef: {
    //       name: invoiceDeploymentName,
    //     },
    //     minReplicaCount: 0,
    //     maxReplicaCount: 5,
    //     pollingInterval: 10,
    //     cooldownPeriod: 10, // seconds
    //     triggers: [
    //       {
    //         type: "aws-sqs-queue",
    //         authenticationRef: {
    //           name: triggerAuthenticationName,
    //         },
    //         metadata: {
    //           queueURL: fulfillmentQueueURL,
    //           queueLength: "2",
    //           awsRegion: cdk.Stack.of(this).region,
    //           identityOwner: "operator",
    //         },
    //       },
    //     ],
    //   },
    // });

    // scaledObject.node.addDependency(triggerAuthentication);
    // scaledObject.node.addDependency(invoiceDeployment);

    // JOB
    const triggerAuthenticationName = `${namespace}-keda-aws-credentials`;
    const triggerAuthentication = cluster.addManifest("TriggerAuthentication", {
      apiVersion: "keda.sh/v1alpha1",
      kind: "TriggerAuthentication",
      metadata: {
        name: triggerAuthenticationName,
        namespace: namespace,
      },
      spec: {
        podIdentity: {
          provider: "aws-eks",
        },
      },
    });
    triggerAuthentication.node.addDependency(invoiceServiceAccount);

    const scaledJob = cluster.addManifest(`InvoiceScaledJob`, {
      apiVersion: "keda.sh/v1alpha1",
      kind: "ScaledJob",
      metadata: {
        name: `${namespace}-aws-sqs-queue-scaled-job`,
        namespace: namespace,
      },
      spec: {
        jobTargetRef: {
          template: {
            metadata: {
              annotations: {
                "sidecar.istio.io/inject": "false", // https://github.com/istio/istio/issues/6324
              },
              labels: {
                app: "invoice-app",
                ...multiTenantLabels,
              },
            },
            spec: {
              serviceAccountName: invoiceServiceAccount.serviceAccountName,
              restartPolicy: "Never",
              containers: [
                {
                  name: "invoice-app",
                  image: this.invoiceImageAsset.imageUri,
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
                  env: [
                    {
                      name: "PRODUCT_ENDPOINT",
                      value: productServiceDNS,
                    },
                    {
                      name: "QUEUE_URL",
                      value: fulfillmentQueueURL,
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
                },
              ],
            },
          },
        },
        minReplicaCount: 0,
        maxReplicaCount: 5,
        pollingInterval: 30,
        successfulJobsHistoryLimit: 5,
        failedJobsHistoryLimit: 5,
        triggers: [
          {
            type: "aws-sqs-queue",
            authenticationRef: {
              name: triggerAuthenticationName,
            },
            metadata: {
              queueURL: fulfillmentQueueURL,
              queueLength: "5",
              awsRegion: cdk.Stack.of(this).region,
              identityOwner: "operator",
            },
          },
        ],
      },
    });

    scaledJob.node.addDependency(triggerAuthentication);
  }
}
