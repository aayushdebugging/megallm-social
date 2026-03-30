import { createOpenAI } from "@ai-sdk/openai";

// MegaLLM's own API gateway (OpenAI-compatible) — dogfooding
// Uses custom fetch wrapper to properly handle Authorization header
function getMegaLLM() {
  const apiKey = process.env.MEGALLM_API_KEY;
  
  const fetchWithAuth = async (url: string | Request, options?: RequestInit): Promise<Response> => {
    const headers = new Headers(options?.headers || {});
    
    // Remove any existing auth headers to avoid conflicts
    headers.delete("authorization");
    headers.delete("Authorization");
    
    // Add proper Authorization header
    headers.set("Authorization", `Bearer ${apiKey}`);
    
    return fetch(url, {
      ...options,
      headers,
    });
  };
  
  return createOpenAI({
    apiKey, // Provide API key (required by SDK, auth is handled via fetch wrapper)
    baseURL: process.env.MEGALLM_BASE_URL ?? "https://ai.megallm.io/v1",
    fetch: fetchWithAuth as any,
  } as any);
}

// Read model names at request time to ensure dotenv has loaded
function getModelConfig() {
  return {
    content: process.env.MEGALLM_MODEL_CONTENT ?? "gemini-2.5-flash",
    fast: process.env.MEGALLM_MODEL_FAST ?? "gemini-2.5-flash",
    analysis: process.env.MEGALLM_MODEL_ANALYSIS ?? "gemini-2.5-flash",
  };
}

export const models = {
  // Long-form content generation (blog posts, comparisons)
  get content() {
    const config = getModelConfig();
    const megallm = getMegaLLM();
    return megallm.chat(config.content);
  },

  // Short-form generation (social posts, summaries)
  get fast() {
    const config = getModelConfig();
    const megallm = getMegaLLM();
    return megallm.chat(config.fast);
  },

  // Analysis and strategy (trend synthesis, feedback analysis)
  get analysis() {
    const config = getModelConfig();
    const megallm = getMegaLLM();
    return megallm.chat(config.analysis);
  },
};
