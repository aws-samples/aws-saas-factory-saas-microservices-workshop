import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { AddOnStackProps } from "../interface/addon-props";

export class CloudwatchAgentAddOnStack extends Construct {
  public readonly cloudwatchAgentEndpoint: string;
  public readonly cloudwatchAgentLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: AddOnStackProps) {
    super(scope, id);

    const cluster = props.cluster;

    const cloudwatchAgentPort = 25888;
    const xrayPort = 2000;
    const cloudwatchAgentProtocol = "TCP";
    const cloudwatchAgentNamespaceName = "amazon-cloudwatch";
    const cloudwatchAgentServiceName = "cloudwatch-agent-service";
    const cloudwatchAgentConfigMapName = "cw-agent-config-map";
    this.cloudwatchAgentEndpoint = `http://${cloudwatchAgentServiceName}.${cloudwatchAgentNamespaceName}:${cloudwatchAgentPort}`;

    this.cloudwatchAgentLogGroup = new logs.LogGroup(
      this,
      "cloudwatch-agent-log-group",
      {
        retention: logs.RetentionDays.ONE_WEEK,
      }
    );

    const cloudwatchAgentNamespace = cluster.addManifest(
      "my-cloudwatchagent-namespace",
      {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: { name: cloudwatchAgentNamespaceName },
      }
    );

    const serviceAccountName = "cloudwatch-agent-svc-account";
    const sa = cluster.addServiceAccount("cloudwatch-agent-svc-account", {
      name: serviceAccountName,
      namespace: cloudwatchAgentNamespaceName,
    });

    const cloudwatchAgentDaemonAccess =
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy");
    sa.role.addManagedPolicy(cloudwatchAgentDaemonAccess);

    sa.node.addDependency(cloudwatchAgentNamespace);

    const cloudwatchAgentAppName = "cloudwatch-agent-daemon";
    const cloudwatchAgentService = cluster.addManifest(
      "my-cloudwatch-agent-service",
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: cloudwatchAgentServiceName,
          namespace: cloudwatchAgentNamespaceName,
        },
        spec: {
          selector: {
            app: cloudwatchAgentAppName,
          },
          clusterIP: "None",
          ports: [
            {
              name: "incoming",
              port: cloudwatchAgentPort,
              protocol: cloudwatchAgentProtocol,
            },
          ],
        },
      }
    );

    cloudwatchAgentService.node.addDependency(cloudwatchAgentNamespace);

    const daemon = cluster.addManifest("test", {
      apiVersion: "apps/v1",
      kind: "DaemonSet",
      metadata: {
        name: "cloudwatch-agent-daemon-config",
        namespace: cloudwatchAgentNamespaceName,
      },
      spec: {
        selector: {
          matchLabels: {
            app: cloudwatchAgentAppName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: cloudwatchAgentAppName,
            },
          },
          spec: {
            containers: [
              {
                env: [
                  {
                    name: "HOST_IP",
                    valueFrom: {
                      fieldRef: {
                        apiVersion: "v1",
                        fieldPath: "status.hostIP",
                      },
                    },
                  },
                  {
                    name: "HOST_NAME",
                    valueFrom: {
                      fieldRef: {
                        apiVersion: "v1",
                        fieldPath: "spec.nodeName",
                      },
                    },
                  },
                  {
                    name: "K8S_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        apiVersion: "v1",
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
                image: "amazon/cloudwatch-agent:1.247350.0b251780",
                imagePullPolicy: "Always",
                name: "aws-cloudwatch-metrics",
                resources: {
                  limits: {
                    cpu: "100m",
                    memory: "100Mi",
                  },
                  requests: {
                    cpu: "100m",
                    memory: "100Mi",
                  },
                },
                volumeMounts: [
                  {
                    mountPath: "/etc/cwagentconfig",
                    name: "cwagentconfig",
                  },
                  {
                    mountPath: "/rootfs",
                    name: "rootfs",
                    readOnly: true,
                  },
                  {
                    mountPath: "/var/run/docker.sock",
                    name: "dockersock",
                    readOnly: true,
                  },
                  {
                    mountPath: "/var/lib/docker",
                    name: "varlibdocker",
                    readOnly: true,
                  },
                  {
                    mountPath: "/run/containerd/containerd.sock",
                    name: "containerdsock",
                    readOnly: true,
                  },
                  {
                    mountPath: "/sys",
                    name: "sys",
                    readOnly: true,
                  },
                  {
                    mountPath: "/dev/disk",
                    name: "devdisk",
                    readOnly: true,
                  },
                ],
              },
            ],
            serviceAccountName: serviceAccountName,
            volumes: [
              {
                configMap: {
                  defaultMode: 420,
                  name: cloudwatchAgentConfigMapName,
                },
                name: "cwagentconfig",
              },
              {
                hostPath: {
                  path: "/",
                  type: "",
                },
                name: "rootfs",
              },
              {
                hostPath: {
                  path: "/var/run/docker.sock",
                  type: "",
                },
                name: "dockersock",
              },
              {
                hostPath: {
                  path: "/var/lib/docker",
                  type: "",
                },
                name: "varlibdocker",
              },
              {
                hostPath: {
                  path: "/run/containerd/containerd.sock",
                  type: "",
                },
                name: "containerdsock",
              },
              {
                hostPath: {
                  path: "/sys",
                  type: "",
                },
                name: "sys",
              },
              {
                hostPath: {
                  path: "/dev/disk/",
                  type: "",
                },
                name: "devdisk",
              },
            ],
          },
        },
        updateStrategy: {
          rollingUpdate: {
            maxSurge: 0,
            maxUnavailable: 1,
          },
          type: "RollingUpdate",
        },
      },
    });

    const cloudwatchAgentDaemon = cluster.addManifest("configmap", {
      apiVersion: "v1",
      data: {
        "cwagentconfig.json": JSON.stringify({
          agent: { debug: true },
          logs: {
            metrics_collected: {
              kubernetes: {
                cluster_name: cluster.clusterName,
                metrics_collection_interval: 60,
              },
              emf: {
                service_address: `${cloudwatchAgentProtocol.toLowerCase()}://0.0.0.0:${cloudwatchAgentPort}`,
              },
            },
            force_flush_interval: 5,
          },
        }),
        traces_collected: {
          xray: {
            bind_address: `0.0.0.0:${xrayPort}`,
            tcp_proxy: {
              bind_address: `0.0.0.0:${xrayPort}`,
            },
          },
        },
      },
      kind: "ConfigMap",
      metadata: {
        name: cloudwatchAgentConfigMapName,
        namespace: cloudwatchAgentNamespaceName,
      },
    });

    cloudwatchAgentDaemon.node.addDependency(cloudwatchAgentNamespace);
    cloudwatchAgentDaemon.node.addDependency(cloudwatchAgentService);
  }
}
