import {
  ShabbatModeError,
  ShabbatModeErrorCode,
} from "./shabbatModeTypes";

export type IntentFlowResult = "PROCEED" | "ABORT";

type IntentFlowHandler = () => Promise<IntentFlowResult>;

let intentFlowHandler: IntentFlowHandler | null = null;

export const setIntentFlowHandler = (handler: IntentFlowHandler): void => {
  // UI layer registers the handler; module stays UI-agnostic.
  intentFlowHandler = handler;
};

export const clearIntentFlowHandler = (): void => {
  intentFlowHandler = null;
};

export const runIntentFlow = async (): Promise<IntentFlowResult> => {
  if (!intentFlowHandler) {
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Intent flow handler is not registered.",
    } satisfies ShabbatModeError;
  }
  return intentFlowHandler();
};
