import { ApplicationStackProps } from "./application-props";

export interface ApplicationAdvancedTierStackProps
  extends ApplicationStackProps {
  tenantId: string;
  namespace: string;
}
