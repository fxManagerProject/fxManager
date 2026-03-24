export interface Migration {
  version: number;
  description: string;
  up: string[];
}
