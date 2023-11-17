// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { AddOnStackProps } from "../interface/addon-props";

export class CloudwatchAgentAddOnStack extends Construct {
  public readonly cloudwatchAgentLogEndpoint: string;
  public readonly cloudwatchAgentLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: AddOnStackProps) {
    super(scope, id);

    const cluster = props.cluster;

    const cloudwatchAgentPort = 25888;
    const cloudwatchAgentProtocol = "TCP";
    const cloudwatchAgentNamespaceName = "amazon-cloudwatch";
    const cloudwatchAgentServiceName = "cloudwatch-agent-service";
    const cloudwatchAgentConfigMapName = "cloudwatch-agent-config-map";
    this.cloudwatchAgentLogEndpoint = `http://${cloudwatchAgentServiceName}.${cloudwatchAgentNamespaceName}:${cloudwatchAgentPort}`;

    this.cloudwatchAgentLogGroup = new logs.LogGroup(
      this,
      "cloudwatch-agent-log-group",
      {
        ...(props.workshopSSMPrefix && {
          logGroupName: `${props.workshopSSMPrefix}/cloudwatch-agent-logs`,
        }),
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

    sa.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
    );

    sa.node.addDependency(cloudwatchAgentNamespace);

    const cloudwatchAgentClusterRole = cluster.addManifest(
      "cloudwatch-agent-cluster-role",
      {
        kind: "ClusterRole",
        apiVersion: "rbac.authorization.k8s.io/v1",
        metadata: {
          name: "cloudwatch-agent-role",
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["pods", "nodes", "endpoints"],
            verbs: ["list", "watch"],
          },
          {
            apiGroups: ["apps"],
            resources: [
              "replicasets",
              "daemonsets",
              "deployments",
              "statefulsets",
            ],
            verbs: ["list", "watch"],
          },
          {
            apiGroups: ["batch"],
            resources: ["jobs"],
            verbs: ["list", "watch"],
          },
          {
            apiGroups: [""],
            resources: ["nodes/proxy"],
            verbs: ["get"],
          },
          {
            apiGroups: [""],
            resources: ["nodes/stats", "configmaps", "events"],
            verbs: ["create"],
          },
          {
            apiGroups: [""],
            resources: ["configmaps"],
            resourceNames: ["cwagent-clusterleader"],
            verbs: ["get", "update"],
          },
          {
            nonResourceURLs: ["/metrics"],
            verbs: ["get", "list", "watch"],
          },
        ],
      }
    );

    cloudwatchAgentClusterRole.node.addDependency(sa);
    const cloudwatchAgentClusterRoleBinding = cluster.addManifest(
      "cloudwatch-agent-cluster-role-binding",
      {
        kind: "ClusterRoleBinding",
        apiVersion: "rbac.authorization.k8s.io/v1",
        metadata: {
          name: "cloudwatch-agent-role-binding",
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: serviceAccountName,
            namespace: cloudwatchAgentNamespaceName,
          },
        ],
        roleRef: {
          kind: "ClusterRole",
          name: "cloudwatch-agent-role",
          apiGroup: "rbac.authorization.k8s.io",
        },
      }
    );

    cloudwatchAgentClusterRoleBinding.node.addDependency(
      cloudwatchAgentClusterRole
    );

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
              name: "logs",
              port: cloudwatchAgentPort,
              protocol: cloudwatchAgentProtocol,
            },
          ],
        },
      }
    );

    cloudwatchAgentService.node.addDependency(cloudwatchAgentNamespace);

    const cloudwatchAgentConfigMap = cluster.addManifest(
      "cloudwatchAgentConfigMap",
      {
        apiVersion: "v1",
        data: {
          "cwagentconfig.json": JSON.stringify({
            agent: { debug: false },
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
            }
          }),
        },
        kind: "ConfigMap",
        metadata: {
          name: cloudwatchAgentConfigMapName,
          namespace: cloudwatchAgentNamespaceName,
        },
      }
    );
    cloudwatchAgentConfigMap.node.addDependency(cloudwatchAgentService);

    const cloudwatchDaemonSet = cluster.addManifest("CloudwatchDaemonSet", {
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
                image:
                  "public.ecr.aws/cloudwatch-agent/cloudwatch-agent:1.300028.1b210",
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

    cloudwatchDaemonSet.node.addDependency(sa);
    cloudwatchDaemonSet.node.addDependency(cloudwatchAgentConfigMap);
  }
}
