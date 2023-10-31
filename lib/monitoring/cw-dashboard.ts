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
          dimensionsMap: { ServiceName: "order" },
          statistic: cloudwatch.Stats.SAMPLE_COUNT,
        }),
      ],
      height: 4,
      width: 12,
      title: "COUNT(OrderCreated)",
    });

    const invoiceTotalWidget = new cloudwatch.SingleValueWidget({
      metrics: [
        new cloudwatch.Metric({
          namespace: namespace,
          metricName: "InvoiceTotalPrice",
          dimensionsMap: {
            ServiceName: "invoice",
          },
          statistic: cloudwatch.Stats.SUM,
        }),
      ],
      height: 4,
      width: 12,
      title: "SUM(InvoiceTotalPrice)",
    });

    const orderCountByTenantGraph = new cloudwatch.GraphWidget({
      view: cloudwatch.GraphWidgetView.PIE,
      statistic: cloudwatch.Stats.SUM,
      height: 11,
      width: 12,
    });

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-a",
          ServiceName: "order",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-a",
          ServiceName: "order",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-b",
          ServiceName: "order",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-c",
          ServiceName: "order",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-d",
          ServiceName: "order",
        },
      })
    );

    orderCountByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "OrderCreated",
        dimensionsMap: {
          Tenant: "tenant-e",
          ServiceName: "order",
        },
      })
    );

    const invoiceTotalByTenantGraph = new cloudwatch.GraphWidget({
      view: cloudwatch.GraphWidgetView.PIE,
      statistic: cloudwatch.Stats.SUM,
      height: 11,
      width: 12,
    });

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-a",
          ServiceName: "invoice",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-b",
          ServiceName: "invoice",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-c",
          ServiceName: "invoice",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-d",
          ServiceName: "invoice",
        },
      })
    );

    invoiceTotalByTenantGraph.addRightMetric(
      new cloudwatch.Metric({
        namespace: namespace,
        metricName: "InvoiceTotalPrice",
        dimensionsMap: {
          Tenant: "tenant-e",
          ServiceName: "invoice",
        },
      })
    );

    new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `${workshopSSMPrefix}-dashboard`,
      periodOverride: cloudwatch.PeriodOverride.AUTO,
      widgets: [
        // https://github.com/aws/aws-cdk/issues/8938#issuecomment-849178914
        [orderCountWidget, invoiceTotalWidget],
        [orderCountByTenantGraph, invoiceTotalByTenantGraph],
      ],
    });
  }
}
