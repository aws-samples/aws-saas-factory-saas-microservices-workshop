import * as cdk from "aws-cdk-lib";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";

var path = require("path");

export class TokenVendorStack extends cdk.Stack {
  public readonly tokenVendorImage: DockerImageAsset;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.tokenVendorImage = new DockerImageAsset(
      this,
      "my-token-vendor-image",
      {
        directory: path.join(__dirname, "../app"),
      }
    );
  }
}
