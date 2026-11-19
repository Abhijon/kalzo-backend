import { env } from "../config/env";
import { ApiError } from "../utils/apiError";

type SurepassEnvelope<T> = {
  success?: boolean;
  status_code?: number;
  message?: string;
  message_code?: string;
  data?: T | null;
};

export type DigilockerInitResult = {
  client_id: string;
  token?: string;
  url?: string;
  expiry_seconds?: number;
};

export type DigilockerAadhaarData = {
  client_id?: string;
  name?: string;
  aadhaar_number?: string;
  date_of_birth?: string;
  gender?: string;
  digilocker_metadata?: {
    name?: string;
    gender?: string;
    dob?: string;
  };
  aadhaar_xml_data?: {
    full_name?: string;
    care_of?: string;
    dob?: string;
    gender?: string;
    masked_aadhaar?: string;
    full_address?: string;
    father_name?: string;
    address?: Record<string, string | undefined>;
  };
  aadhaar_pdf?: string;
  aadhaar_xml?: string;
  xml_url?: string;
  address?: Record<string, string | undefined>;
};

function requireToken(): string {
  if (!env.SUREPASS_API_TOKEN) {
    throw new ApiError(503, "Surepass is not configured (missing SUREPASS_API_TOKEN)");
  }
  return env.SUREPASS_API_TOKEN;
}

function baseUrl(): string {
  return env.SUREPASS_BASE_URL.replace(/\/$/, "");
}

type SurepassRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

function isPublicHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    // Surepass WAF returns HTML 403 for localhost / private hosts.
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function surepassFetch<T>(path: string, init: SurepassRequest = {}): Promise<T> {
  const token = requireToken();
  const { body, headers, method = "GET" } = init;
  const url = `${baseUrl()}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await res.text();
  let json: SurepassEnvelope<T> | null = null;
  try {
    json = raw ? (JSON.parse(raw) as SurepassEnvelope<T>) : null;
  } catch {
    const hint =
      res.status === 403
        ? "Surepass blocked the request (often caused by localhost redirect_url/webhook_url)."
        : `Surepass returned a non-JSON response (${res.status}).`;
    throw new ApiError(502, hint);
  }

  if (!res.ok || json?.success === false) {
    const message = json?.message || `Surepass request failed (${res.status})`;
    // Map vendor auth/validation errors to 502 so they don't look like our JWT/auth failures.
    const status =
      res.status === 400 || res.status === 404 || res.status === 422 ? 400 : 502;
    throw new ApiError(status, message);
  }

  if (json?.data == null) {
    throw new ApiError(502, json?.message || "Surepass returned empty data");
  }

  return json.data;
}

export type DigilockerInitInput = {
  redirectUrl?: string;
  webhookUrl?: string;
  logoUrl?: string;
};

/** Digilocker Via Link / Digiboost initialize — returns client_id + token (+ url when available). */
export function initializeDigilocker(input: DigilockerInitInput = {}) {
  const data: Record<string, unknown> = {
    signup_flow: true,
  };

  // Only send publicly reachable URLs. Localhost triggers Surepass HTML 403.
  const redirectUrl = input.redirectUrl ?? env.SUREPASS_REDIRECT_URL;
  if (isPublicHttpUrl(redirectUrl)) data.redirect_url = redirectUrl;

  const webhookUrl =
    input.webhookUrl ??
    env.SUREPASS_WEBHOOK_URL ??
    (env.PUBLIC_API_URL
      ? `${env.PUBLIC_API_URL.replace(/\/$/, "")}/api/v1/webhooks/surepass`
      : undefined);
  if (isPublicHttpUrl(webhookUrl)) data.webhook_url = webhookUrl;

  if (input.logoUrl) data.logo_url = input.logoUrl;

  return surepassFetch<DigilockerInitResult>("/api/v1/digilocker/initialize", {
    method: "POST",
    body: { data },
  });
}

/** Fetch Aadhaar details after Digilocker success (tries GET path, falls back to POST body). */
export async function downloadAadhaar(clientId: string): Promise<DigilockerAadhaarData> {
  try {
    return await surepassFetch<DigilockerAadhaarData>(
      `/api/v1/digilocker/download-aadhaar/${encodeURIComponent(clientId)}`,
      { method: "GET" },
    );
  } catch (first) {
    try {
      return await surepassFetch<DigilockerAadhaarData>("/api/v1/digilocker/download-aadhaar", {
        method: "POST",
        body: { client_id: clientId },
      });
    } catch {
      throw first;
    }
  }
}

export function normalizeAadhaarPayload(data: DigilockerAadhaarData) {
  const xml = data.aadhaar_xml_data;
  const meta = data.digilocker_metadata;

  return {
    name: xml?.full_name ?? meta?.name ?? data.name ?? null,
    maskedAadhaar: xml?.masked_aadhaar ?? data.aadhaar_number ?? null,
    dob: xml?.dob ?? meta?.dob ?? data.date_of_birth ?? null,
    gender: xml?.gender ?? meta?.gender ?? data.gender ?? null,
    fullAddress: xml?.full_address ?? null,
    xmlUrl: data.xml_url ?? null,
  };
}
