import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";

export class MyDashboardStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: {
      namespace: string;
      workshopSSMPrefix: string;
    }
  ) {
    super(scope, id);
    const namespace = props.namespace;
    const workshopSSMPrefix = props.workshopSSMPrefix.replace("/", "");

    const orderCountWidget = new cloudwatch.SingleValueWidget({
      metrics: [
        new cloudwatch.Metric({
          namespace: namespace,
          metricName: "OrderCreated",
          dimensionsMap: { ServiceName: "order", ServiceType: "webapp" },
          statistic: cloudwatch.Stats.SAMPLE_COUNT,
        }),
      ],
      height: 4,
      width: 12,
      period: cdk.Duration.minutes(5),
      title: "COUNT(OrderCreated)",
    });

    const invoiceTotalWidget = new cloudwatch.SingleValueWidget({
      metrics: [
        new cloudwatch.Metric({
          namespace: namespace,
          metricName: "InvoiceTotalPrice",
          dimensionsMap: {
            ServiceName: "invoice",
            ServiceType: "job",
          },
          statistic: cloudwatch.Stats.SUM,
        }),
      ],
      height: 4,
      width: 12,
      period: cdk.Duration.minutes(5),
      title: "SUM(InvoiceTotalPrice)",
    });

    const orderCountByTenantGraph = new cloudwatch.GraphWidget({
      view: cloudwatch.GraphWidgetView.PIE,
      statistic: cloudwatch.Stats.SUM,
      period: cdk.Duration.minutes(5),
      height: 11,
      width: 12,
    });

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-a",
          ServiceName: "basic-order",
          Tier: "basic",
          ServiceType: "webapp",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-a",
          ServiceName: "basic-order",
          Tier: "basic",
          ServiceType: "webapp",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-b",
          ServiceName: "advanced-order",
          Tier: "advanced",
          ServiceType: "webapp",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-c",
          ServiceName: "premium-order",
          Tier: "premium",
          ServiceType: "webapp",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-d",
          ServiceName: "basic-order",
          Tier: "basic",
          ServiceType: "webapp",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-e",
          ServiceName: "advanced-order",
          Tier: "advanced",
          ServiceType: "webapp",
        },
      })
    );

    const invoiceTotalByTenantGraph = new cloudwatch.GraphWidget({
      view: cloudwatch.GraphWidgetView.PIE,
      statistic: cloudwatch.Stats.SUM,
      period: cdk.Duration.minutes(5),
      height: 11,
      width: 12,
    });

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-a",
          ServiceName: "basic-invoice",
          Tier: "basic",
          ServiceType: "job",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-b",
          ServiceName: "tenant-b-invoice",
          Tier: "advanced",
          ServiceType: "job",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-c",
          ServiceName: "tenant-c-invoice",
          Tier: "premium",
          ServiceType: "job",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-d",
          ServiceName: "basic-invoice",
          Tier: "basic",
          ServiceType: "job",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-e",
          ServiceName: "tenant-e-invoice",
          Tier: "advanced",
          ServiceType: "job",
        },
      })
    );

    new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `${workshopSSMPrefix}-dashboard`,
      widgets: [
        // https://github.com/aws/aws-cdk/issues/8938#issuecomment-849178914
        [orderCountWidget, invoiceTotalWidget],
        [orderCountByTenantGraph, invoiceTotalByTenantGraph],
      ],
    });
  }
}
