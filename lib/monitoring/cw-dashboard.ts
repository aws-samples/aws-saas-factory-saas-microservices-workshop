// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";

interface WorkshopDashboardStackProps extends cdk.StackProps {
  namespace: string;
  workshopSSMPrefix: string;
}

export class WorkshopDashboardStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: WorkshopDashboardStackProps
  ) {
    super(scope, id, props);
    const namespace = props.namespace;
    const workshopSSMPrefix = props.workshopSSMPrefix.replace("/", "");
    const period = cdk.Duration.hours(2);
    const widgets = [];

    const metrics = [
      { metricName: "OrderCreated", serviceName: "order" },
      { metricName: "ProductCreated", serviceName: "product" },
      { metricName: "FulfillmentComplete", serviceName: "fulfillment" },
    ];
    const metricsCountGraph = new cloudwatch.GraphWidget({
      view: cloudwatch.GraphWidgetView.BAR,
      statistic: cloudwatch.Stats.SUM,
      period: period,
      height: 11,
      width: 20,
      title: "COUNT(Metrics)",
    });

    metrics.forEach((metric) => {
      metricsCountGraph.addRightMetric(
        new cloudwatch.Metric({
          namespace: namespace,
          metricName: metric.metricName,
          dimensionsMap: { ServiceName: metric.serviceName },
          statistic: cloudwatch.Stats.SAMPLE_COUNT,
          period: period,
        })
      );
    });

    const invoiceTotalValue = new cloudwatch.SingleValueWidget({
      metrics: [
        new cloudwatch.Metric({
          namespace: namespace,
          metricName: "InvoiceTotalPrice",
          dimensionsMap: { ServiceName: "invoice" },
          statistic: cloudwatch.Stats.SUM,
          period: period,
        }),
      ],
      height: 11,
      width: 4,
      title: "SUM(InvoiceTotalPrice)",
    });
    widgets.push([metricsCountGraph, invoiceTotalValue]);

    /* // Start LAB6 - Tenant-aware widgets
    const tenantIds = [
      "tenant-a",
      "tenant-b",
      "tenant-c",
      "tenant-d",
      "tenant-e",
    ];
    const orderCountByTenantGraph = new cloudwatch.GraphWidget({
      view: cloudwatch.GraphWidgetView.PIE,
      statistic: cloudwatch.Stats.SUM,
      period: period,
      height: 11,
      width: 12,
      title: "COUNT(OrderCreated) by Tenant",
    });

    tenantIds.forEach((tenantId) => {
      orderCountByTenantGraph.addRightMetric(
        new cloudwatch.Metric({
          namespace: namespace,
          metricName: "OrderCreated",
          dimensionsMap: {
            Tenant: tenantId,
            ServiceName: "order",
          },
        })
      );
    });

    const invoiceTotalByTenantGraph = new cloudwatch.GraphWidget({
      view: cloudwatch.GraphWidgetView.PIE,
      statistic: cloudwatch.Stats.SUM,
      period: period,
      height: 11,
      width: 12,
      title: "SUM(InvoiceTotalPrice) by Tenant",
    });

    tenantIds.forEach((tenantId) => {
      invoiceTotalByTenantGraph.addRightMetric(
        new cloudwatch.Metric({
          namespace: namespace,
          metricName: "InvoiceTotalPrice",
          dimensionsMap: {
            Tenant: tenantId,
            ServiceName: "invoice",
          },
        })
      );
    });
    widgets.push([orderCountByTenantGraph, invoiceTotalByTenantGraph]);
    */ // End LAB6 - Tenant-aware widgets

    new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `${workshopSSMPrefix}-dashboard`,
      widgets: widgets, // https://github.com/aws/aws-cdk/issues/8938#issuecomment-849178914
    });
  }
}
