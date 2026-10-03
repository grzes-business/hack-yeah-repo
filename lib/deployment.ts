export type DeploymentEnvironment = "local" | "preview" | "production";

export function getDeploymentEnvironment(): DeploymentEnvironment {
  switch (process.env.VERCEL_ENV) {
    case "production":
      return "production";
    case "preview":
      return "preview";
    default:
      return "local";
  }
}
