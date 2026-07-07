import { bizinfo } from "./bizinfo";
import { kstartup } from "./kstartup";
import { mss } from "./mss";
import { moisBenefit } from "./mois-benefit";
import { msit } from "./msit";
import type { SourceAdapter } from "../types";

export const adapters: SourceAdapter[] = [bizinfo, kstartup, mss, moisBenefit, msit];
