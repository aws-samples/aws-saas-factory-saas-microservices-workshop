import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
var path = require("path");

export class SharedStack extends Construct {
  public readonly sharedImageAsset: DockerImageAsset;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const sharedImageAsset = new DockerImageAsset(
      this,
      "ProductAppContainerImage",
      {
        directory: path.join(__dirname, "../app"),
      }
    );

    this.sharedImageAsset = sharedImageAsset;
  }
}
