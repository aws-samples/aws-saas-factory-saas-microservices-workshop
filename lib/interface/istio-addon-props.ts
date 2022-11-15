import { AddOnStackProps } from "./addon-props";

export interface IstioAddOnStackProps extends AddOnStackProps {
  issuer: string;
  jwksUri: string;
  tlsCert: string;
  tlsKey: string;
}
