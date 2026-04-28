import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { DEV_MODE } from "../config/devMode";

export enum AuthErrorCode {
  CANCELED = "CANCELED",
  NETWORK = "NETWORK",
  UNAUTHORIZED = "UNAUTHORIZED",
  UNKNOWN = "UNKNOWN",
}

export type AuthError = {
  code: AuthErrorCode;
  message: string;
};

class AuthErrorImpl extends Error implements AuthError {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type AppleAuthResult = {
  idToken: string;
  rawNonce: string;
  fullName: string | null;
  email: string | null;
};

type AppleAuthStubConfig = {
  forceCancel: boolean;
  forceUnauthorized: boolean;
  forceNetwork: boolean;
};

let stubConfig: AppleAuthStubConfig = {
  forceCancel: false,
  forceUnauthorized: false,
  forceNetwork: false,
};

// DEV MODE STUB — replace with real native implementation.
export const setAppleAuthStubConfig = (next: Partial<AppleAuthStubConfig>): void => {
  stubConfig = { ...stubConfig, ...next };
};

const createNonce = (): { rawNonce: string; hashedNonce: string } => {
  // Nonce + SHA256 is required for Apple Sign-In to prevent replay attacks.
  const rawNonce = uuidv4();
  const hashedNonce = bytesToHex(sha256(utf8ToBytes(rawNonce)));
  return { rawNonce, hashedNonce };
};

const mapAppleError = (error: unknown): AuthError => {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    if (code === appleAuth.Error.CANCELED) {
      return { code: AuthErrorCode.CANCELED, message: "Sign in canceled." };
    }
    const message = String((error as { message?: string }).message ?? "");
    if (message) {
      return { code: AuthErrorCode.UNKNOWN, message };
    }
  }

  return { code: AuthErrorCode.UNKNOWN, message: "Unknown auth error." };
};

export const signInWithApple = async (): Promise<AppleAuthResult> => {
  if (DEV_MODE) {
    // DEV MODE STUB — replace with real native implementation.
    if (stubConfig.forceCancel) {
      throw new AuthErrorImpl(
        AuthErrorCode.CANCELED,
        "Sign in canceled (stub)."
      );
    }
    if (stubConfig.forceUnauthorized) {
      throw new AuthErrorImpl(
        AuthErrorCode.UNAUTHORIZED,
        "Unauthorized (stub)."
      );
    }
    if (stubConfig.forceNetwork) {
      throw new AuthErrorImpl(AuthErrorCode.NETWORK, "Network error (stub).");
    }

    const { rawNonce } = createNonce();
    console.log("DEV MODE STUB — Apple Sign-In simulated.");
    return {
      idToken: `dev-token-${uuidv4()}`,
      rawNonce,
      fullName: "Dev User",
      email: "dev.user@example.com",
    };
  }

  if (!appleAuth.isSupported) {
    // Avoid presenting a button on unsupported devices or simulators.
    throw new AuthErrorImpl(
      AuthErrorCode.UNAUTHORIZED,
      "Apple Sign-In is not supported on this device."
    );
  }

  try {
    const { rawNonce, hashedNonce } = createNonce();
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      nonce: hashedNonce,
    });

    const idToken = response.identityToken;
    if (!idToken) {
      throw new AuthErrorImpl(
        AuthErrorCode.UNAUTHORIZED,
        "Missing identity token from Apple."
      );
    }

    const fullName =
      response.fullName && (response.fullName.givenName || response.fullName.familyName)
        ? [response.fullName.givenName, response.fullName.familyName]
            .filter(Boolean)
            .join(" ")
        : null;

    return {
      idToken,
      rawNonce,
      fullName,
      email: response.email ?? null,
    };
  } catch (error) {
    const mapped = mapAppleError(error);
    throw new AuthErrorImpl(mapped.code, mapped.message);
  }
};
