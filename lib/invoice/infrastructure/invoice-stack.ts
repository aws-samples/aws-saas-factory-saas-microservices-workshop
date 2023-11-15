import * as cdk from "aws-cdk-lib";
import * as aws_events from "aws-cdk-lib/aws-events";
import * as aws_events_targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { InvoiceMicroserviceStackProps } from "../../interface/invoice-microservice-props";
import { MicroserviceStack } from "../../abstract-class/microservice-stack";

var path = require("path");

export class InvoiceStack extends MicroserviceStack {
  public readonly invoiceImageAsset: DockerImageAsset;
  public readonly serviceName: string = "invoice";
  constructor(
    scope: Construct,
    id: string,
    props: InvoiceMicroserviceStackProps
  ) {
    super(scope, id, props);

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
    const multiTenantLabels = {
      tenantTier: tenantTier,
      ...(tenantId && { tenantId: tenantId }),
    };

    cdk.Tags.of(this).add("SaaS-Microservices:ServiceName", this.serviceName);

    const invoiceQueue = new sqs.Queue(this, `Invoice-Queue-${namespace}`, {
      retentionPeriod: cdk.Duration.days(1),
    });

    const invoiceQueueTarget = new aws_events_targets.SqsQueue(invoiceQueue);
    new aws_events.Rule(this, "invoiceRule", {
      eventBus: eventBus,
      eventPattern: {
        detailType: [fulfillmentEventDetailType],
        source: [fulfillmentEventSource],
        /* // LAB4: REMOVE THIS LINE (routing)
        detail: {
          ...(tenantId && {
            tenantId: [tenantId],
          }),
          tenantTier: [tenantTier],
        },
        */ // LAB4: REMOVE THIS LINE (routing)
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
              BASE_IMAGE: baseImage,
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
                  env: this.combineWithBaseContainerEnvs([
                    {
                      name: "PRODUCT_ENDPOINT",
                      value: productServiceDNS,
                    },
                    {
                      name: "QUEUE_URL",
                      value: invoiceQueue.queueUrl,
                    },
                  ]),
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
