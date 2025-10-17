/**
 * auth.ts
 *
 * Helper utilities for mapping Firebase Auth errors (and other auth-related errors)
 * to friendly messages, suggested UI handling, and field-level hints.
 *
 * This module is intentionally framework-agnostic: it returns plain data structures
 * that UI code (forms, toasts, alerts) can consume to render a user-friendly error.
 *
 * Usage:
 *  const info = mapAuthError(err);
 *  // info = { code, title, message, field, severity }
 *
 *  // then in UI:
 *  // - display `info.title` / `info.message` in a toast/modal
 *  // - if info.field is present, mark that form field as invalid and show message
 *
 * Notes:
 *  - Firebase error objects usually have a `.code` like "auth/invalid-email".
 *  - This helper accepts unknown inputs and tries to extract a code/message safely.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AuthErrorSeverity = "error" | "warning" | "info";

export type AuthErrorField = "email" | "password" | "general" | "provider";

export interface AuthErrorInfo {
  /**
   * Original error code (if available). For Firebase this is usually like `auth/wrong-password`.
   * If the code is unavailable we return `"unknown"`.
   */
  code: string;
  /**
   * Short title suitable for a toast/alert heading.
   */
  title: string;
  /**
   * Detailed friendly message suitable for showing to end-users.
   */
  message: string;
  /**
   * Optional field hint so form logic can attach the error to a specific input.
   */
  field?: AuthErrorField;
  /**
   * Severity controls treatment in UI (error -> destructive; warning -> softer).
   */
  severity: AuthErrorSeverity;
  /**
   * Optional raw data; keep the original error available for logging if desired.
   */
  original?: any;
}

/**
 * A centralized mapping for known Firebase Auth error codes to
 * user-friendly titles, messages and optional field hints.
 *
 * Keep messages short but actionable. Avoid leaking internal error details.
 */
const ERROR_MAP: Record<
  string,
  { title: string; message: string; field?: AuthErrorField; severity?: AuthErrorSeverity }
> = {
  // Sign-in / credential errors
  "auth/invalid-email": {
    title: "Invalid email",
    message: "Please enter a valid email address.",
    field: "email",
  },
  "auth/user-not-found": {
    title: "No account found",
    message: "No account exists for this email. Please register first.",
    field: "email",
  },
  "auth/wrong-password": {
    title: "Incorrect password",
    message: "The password you entered is incorrect. Try again or reset your password.",
    field: "password",
  },
  "auth/user-disabled": {
    title: "Account disabled",
    message: "This account has been disabled. Contact support if you believe this is an error.",
  },
  "auth/too-many-requests": {
    title: "Too many attempts",
    message:
      "We detected unusual activity from this device. Please try again later or reset your password.",
    severity: "warning",
  },
  "auth/network-request-failed": {
    title: "Network error",
    message: "Network error. Check your connection and try again.",
    severity: "warning",
  },

  // Registration errors
  "auth/email-already-in-use": {
    title: "Email already used",
    message:
      "This email is already associated with an account. Try signing in or use a different email.",
    field: "email",
  },
  "auth/weak-password": {
    title: "Weak password",
    message: "Your password is too weak. Use at least 6 characters.",
    field: "password",
  },

  // OAuth / popup errors
  "auth/popup-closed-by-user": {
    title: "Sign-in canceled",
    message: "Sign-in was canceled. Try again to continue with the provider.",
    severity: "info",
  },
  "auth/popup-blocked": {
    title: "Popup blocked",
    message: "The sign-in popup was blocked by your browser. Allow popups and try again.",
    severity: "warning",
  },
  "auth/cancelled-popup-request": {
    title: "Sign-in canceled",
    message: "Sign-in was canceled. Try again to continue with the provider.",
    severity: "info",
  },
  "auth/account-exists-with-different-credential": {
    title: "Account exists",
    message:
      "An account already exists with the same email but different sign-in credentials. Sign in using the original provider or reset your password.",
    field: "provider",
  },
  "auth/credential-already-in-use": {
    title: "Credential already used",
    message:
      "These sign-in credentials are already linked with another account. Try signing in with the existing account.",
  },

  // Misc / security
  "auth/missing-email": {
    title: "Missing email",
    message: "Please provide an email address to continue.",
    field: "email",
  },
  "auth/requires-recent-login": {
    title: "Re-authentication required",
    message: "Please sign in again to perform this sensitive operation.",
  },
  "auth/operation-not-allowed": {
    title: "Operation not allowed",
    message: "This sign-in method is not enabled in the project configuration.",
  },
  "auth/invalid-credential": {
    title: "Invalid credentials",
    message: "The sign-in credential is invalid. Try again.",
  },
};

/**
 * Safely extract an error code from an unknown error object.
 *
 * Firebase errors generally have a `code` property. This function is defensive:
 * it will attempt to read `.code` or parse from `.message`, and finally fall back to 'unknown'.
 */
function extractErrorCode(err: unknown): string {
  if (!err) return "unknown";
  try {
    const anyErr = err as any;
    if (typeof anyErr.code === "string" && anyErr.code.trim().length > 0) {
      return anyErr.code;
    }
    // Some libs include codes inside message, e.g., "Firebase: Error (auth/wrong-password)."
    if (typeof anyErr.message === "string") {
      const match = anyErr.message.match(/\b(auth\/[A-Za-z0-9-_.]+)\b/);
      if (match) return match[1];
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Map an unknown error (often from Firebase Auth) to a friendly AuthErrorInfo object
 * that UI code can use to show a toast, attach to a field, or render an inline error.
 */
export function mapAuthError(err: unknown): AuthErrorInfo {
  const code = extractErrorCode(err);
  const mapping = ERROR_MAP[code];

  if (mapping) {
    return {
      code,
      title: mapping.title,
      message: mapping.message,
      field: mapping.field ?? "general",
      severity: mapping.severity ?? "error",
      original: err,
    };
  }

  // If not in the map, try to provide an informative message based on common patterns.
  // If the original error is a plain Error with a message, include a gentle variant of it.
  const altMessage =
    (err && typeof (err as any).message === "string" && (err as any).message) ??
    "An unexpected error occurred. Please try again.";

  // Sometimes Firebase returns "Firebase: <message> (auth/code)."
  // We want to remove internal prefixes and present a short message.
  const cleaned =
    typeof altMessage === "string"
      ? altMessage.replace(/^Firebase:\s*/i, "").replace(/\s*\(auth\/[^\)]+\)\s*$/, "")
      : "An unexpected error occurred. Please try again.";

  return {
    code: code || "unknown",
    title: "Authentication error",
    message: cleaned,
    field: "general",
    severity: "error",
    original: err,
  };
}

/**
 * Convenience: maps to a simple UI toast descriptor that matches common toast libraries.
 * Consumers can pass the returned object to a toaster to render friendly notifications.
 */
export function authErrorToToastPayload(err: unknown) {
  const info = mapAuthError(err);
  // Build a minimal toast payload: { title, description, type }
  return {
    title: info.title,
    description: info.message,
    // map severity -> toast type (sonner uses 'success'|'error'|'info' etc.)
    type: info.severity === "warning" ? "warning" : info.severity === "info" ? "info" : "error",
    // keep original for logging if needed
    original: info.original,
    code: info.code,
  };
}

/**
 * Utility predicate to test if an error is an auth-related Firebase error.
 */
export function isAuthError(err: unknown): boolean {
  const code = extractErrorCode(err);
  return code.startsWith("auth/");
}

/**
 * Example usage notes for UI integration (not executed code):
 *
 * - Inline form errors
 *    const info = mapAuthError(err);
 *    if (info.field === "email") setEmailError(info.message);
 *    if (info.field === "password") setPasswordError(info.message);
 *
 * - Toasts
 *    const t = authErrorToToastPayload(err);
 *    toast[t.type]({ title: t.title, description: t.description });
 *
 * - Logging
 *    sendToSentry({ ...info, context: { component: 'LoginForm' } });
 *
 */

export default {
  mapAuthError,
  authErrorToToastPayload,
  isAuthError,
};
