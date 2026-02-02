/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Secret used for JWT / session signing */
  readonly ANSIVERSA_AUTH_SECRET?: string;

  /** Secret used for cookie encryption / session management */
  readonly ANSIVERSA_SESSION_SECRET: string;

  /** Domain for cookies (e.g., ansiversa.com) */
  readonly ANSIVERSA_COOKIE_DOMAIN?: string;

  /** Optional: Override the default session cookie name */
  readonly SESSION_COOKIE_NAME?: string;

  /** Optional: Override the root app URL (fallback: https://ansiversa.com) */
  readonly PUBLIC_ROOT_APP_URL?: string;

  /** Parent base URL (used for redirects + notification count) */
  readonly ANSIVERSA_PARENT_BASE_URL?: string;

  /** Dashboard webhook endpoint */
  readonly ANSIVERSA_DASHBOARD_WEBHOOK_URL?: string;

  /** Dashboard webhook secret */
  readonly ANSIVERSA_DASHBOARD_WEBHOOK_SECRET?: string;

  /** Notifications webhook endpoint (optional override) */
  readonly ANSIVERSA_NOTIFICATIONS_WEBHOOK_URL?: string;

  /** Notifications webhook secret (optional) */
  readonly ANSIVERSA_NOTIFICATIONS_WEBHOOK_SECRET?: string;

  /** Quiz API base URL */
  readonly QUIZ_API_BASE_URL?: string;

  /** Optional: Dev-only auth bypass (requires import.meta.env.DEV) */
  readonly DEV_BYPASS_AUTH?: string;

  /** Optional: Dev-only override for bypass user id */
  readonly DEV_BYPASS_USER_ID?: string;

  /** Optional: Dev-only override for bypass user email */
  readonly DEV_BYPASS_EMAIL?: string;

  /** Optional: Dev-only override for bypass user role id */
  readonly DEV_BYPASS_ROLE_ID?: string;
}

interface Window {
  Alpine: import('alpinejs').Alpine;
}

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email: string;
      name?: string;
      roleId?: number;
      stripeCustomerId: string | null;
      plan: string | null;
      planStatus: string | null;
      isPaid: boolean;
      renewalAt: number | null;
    };
    session?: {
      userId: string;
      roleId: string | null;
      plan: string | null;
      planStatus: string | null;
      isPaid: boolean;
      renewalAt: number | null;
    };
    sessionToken?: string | null;
    isAuthenticated?: boolean;
    rootAppUrl?: string;
  }
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
