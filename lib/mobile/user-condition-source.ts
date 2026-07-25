import {
  getRecommendationsBridgeAvailability,
  getUserCondition,
} from "./app-bridge";
import {
  readWebUserCondition,
  type UserCondition,
} from "./user-condition";

export type UserConditionSource = "native" | "web";

export type UserConditionResolution =
  | { status: "ready"; source: UserConditionSource; condition: UserCondition }
  | { status: "missing"; source: UserConditionSource }
  | { status: "outdated"; source: "native" }
  | { status: "error"; source: "native" };

export async function resolveUserCondition(): Promise<UserConditionResolution> {
  const availability = getRecommendationsBridgeAvailability();

  if (availability === "available") {
    const result = await getUserCondition();
    if (!result.success) return { status: "error", source: "native" };
    return result.data.onboarding_completed
      ? { status: "ready", source: "native", condition: result.data }
      : { status: "missing", source: "native" };
  }

  if (availability === "outdated") {
    return { status: "outdated", source: "native" };
  }

  const condition = readWebUserCondition();
  return condition?.onboarding_completed
    ? { status: "ready", source: "web", condition }
    : { status: "missing", source: "web" };
}
