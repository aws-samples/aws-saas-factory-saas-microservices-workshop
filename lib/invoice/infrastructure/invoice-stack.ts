import * as cdk from "aws-cdk-lib";
import * as aws_events from "aws-cdk-lib/aws-events";
import * as aws_events_targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
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

    const productServiceDNS = props.productServiceDNS;
    const cloudwatchAgentLogEndpoint = props.cloudwatchAgentLogEndpoint;
    const cloudwatchAgentLogGroupName = props.cloudwatchAgentLogGroupName;
    const baseImage = props.baseImage;

    const tenantTier = props.tenantTier;
    const tenantId = props.tenantId;
    const namespace = props.namespace;
    const eventBus = props.eventBus;
    const fulfillmentEventDetailType = props.fulfillmentEventDetailType;
    const fulfillmentEventSource = props.fulfillmentEventSource;
    const serviceName = tenantId
      ? `${tenantId}-invoice`
      : `${tenantTier}-invoice`;
    const serviceType = "job";
    const multiTenantLabels = {
      tenantTier: tenantTier,
      ...(tenantId && { tenantId: tenantId }),
    };

    cdk.Tags.of(this).add("SaaS-Microservices:ServiceName", serviceName);

    const invoiceQueue = new sqs.Queue(this, `Invoice-Queue-${namespace}`, {
      retentionPeriod: cdk.Duration.days(1),
    });

    const invoiceQueueTarget = new aws_events_targets.SqsQueue(invoiceQueue);
    new aws_events.Rule(this, "invoiceRule", {
      eventBus: eventBus,
      eventPattern: {
        detailType: [fulfillmentEventDetailType],
        source: [fulfillmentEventSource],
        detail: {
          ...(tenantId && {
            tenantId: [tenantId],
          }),
          tenantTier: [tenantTier],
        },
      },
      targets: [invoiceQueueTarget],
    });

    if (props.applicationImageAsset) {
      this.invoiceImageAsset = props.applicationImageAsset;
    } else {
      const invoiceImage = new DockerImageAsset(
        this,
        "InvoiceAppContainerImage",
        {
          directory: path.join(__dirname, "../app"),
          ...(baseImage && {
            buildArgs: {
              BASE_IMAGE: baseImage.imageUri,
            },
          }),
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
        resources: [invoiceQueue.queueArn],
      })
    );

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
                      value: invoiceQueue.queueUrl,
                    },
                    {
                      name: "AWS_DEFAULT_REGION",
                      value: cdk.Stack.of(this).region,
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
                      name: "SERVICE_NAME",
                      value: serviceName,
                    },
                    {
                      name: "SERVICE_TYPE",
                      value: serviceType,
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
              queueURL: invoiceQueue.queueUrl,
              queueLength: "30",
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
