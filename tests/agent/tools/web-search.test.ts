import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { toolContextFor } from "../../helpers/tool-context";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("TAVILY_API_KEY", "tvly-test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web_search", () => {
  it("searches Tavily and returns compact results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          query: "near ai qwen",
          results: [
            {
              title: "NEAR AI Cloud",
              url: "https://near.ai",
              content: "Confidential inference.",
              score: 0.9,
              published_date: "2026-10-01",
            },
          ],
          response_time: 0.4,
        })
      )
    );
    const webSearch = await loadWebSearch();

    const results = await webSearch.execute(
      { query: "near ai qwen", topic: "news", timeRange: "week" },
      toolContextFor({ toolName: "web_search" })
    );

    expect(results).toEqual([
      {
        title: "NEAR AI Cloud",
        url: "https://near.ai",
        content: "Confidential inference.",
        publishedDate: "2026-10-01",
      },
    ]);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe("https://api.tavily.com/search");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer tvly-test-key"
    );
    expect(JSON.parse(z.string().parse(init?.body))).toEqual({
      query: "near ai qwen",
      topic: "news",
      time_range: "week",
      search_depth: "basic",
      max_results: 8,
      include_published_date: true,
    });
  });

  it("reports a failed Tavily request without its response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("quota exceeded", { status: 432 }))
    );
    const webSearch = await loadWebSearch();

    await expect(
      webSearch.execute({ query: "anything" }, toolContextFor())
    ).rejects.toThrow("Tavily search failed with HTTP 432.");
  });

  it("explains that search is unavailable without a key", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    const webSearch = await loadWebSearch();

    await expect(
      webSearch.execute({ query: "anything" }, toolContextFor())
    ).rejects.toThrow("Web search is unavailable: TAVILY_API_KEY is not set.");
    expect(fetch).not.toHaveBeenCalled();
  });
});

async function loadWebSearch() {
  const { default: webSearch } = await import("@agent/tools/web_search");
  return webSearch;
}
