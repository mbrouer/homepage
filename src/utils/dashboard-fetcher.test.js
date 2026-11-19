// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import useSWR, { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";

import dashboardFetcher from "./dashboard-fetcher";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboardFetcher", () => {
  it("returns successful JSON and forwards fetch options", async () => {
    const data = [{ name: "Services" }];
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));
    vi.stubGlobal("fetch", fetch);
    const init = { cache: "no-store" };

    await expect(dashboardFetcher("/api/services", init)).resolves.toEqual(data);
    expect(fetch).toHaveBeenCalledWith("/api/services", init);
  });

  it("rejects expired sessions without returning the error object as dashboard data", async () => {
    const replace = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/", search: "?view=home", hash: "#my-tab", replace },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
    );

    await expect(dashboardFetcher("/api/bookmarks")).rejects.toMatchObject({ status: 401 });
    expect(replace).toHaveBeenCalledWith("/auth/signin?callbackUrl=%2F%3Fview%3Dhome%23my-tab");
  });

  it.each([400, 403, 500, 502])("rejects HTTP %i without redirecting or parsing the error body", async (status) => {
    const replace = vi.fn();
    const json = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json }));

    await expect(dashboardFetcher("/api/services")).rejects.toMatchObject({ status });
    expect(replace).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it("rejects unauthorized requests outside the browser", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(dashboardFetcher("/api/widgets")).rejects.toMatchObject({ status: 401 });
  });

  it("propagates network errors", async () => {
    const error = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));

    await expect(dashboardFetcher("/api/services")).rejects.toBe(error);
  });

  it("preserves cached dashboard arrays when revalidation fails", async () => {
    const data = [{ name: "Services" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 })),
    );
    const { result } = renderHook(
      () => {
        const {
          data: services,
          error,
          mutate,
        } = useSWR("/api/services", dashboardFetcher, {
          fallbackData: data,
          revalidateOnMount: false,
        });
        return { data: services, error, mutate };
      },
      {
        wrapper: ({ children }) =>
          createElement(SWRConfig, { value: { provider: () => new Map(), shouldRetryOnError: false } }, children),
      },
    );

    await act(async () => {
      await result.current.mutate();
    });

    expect(result.current.data).toEqual(data);
    expect(result.current.error).toMatchObject({ status: 503 });
  });
});
