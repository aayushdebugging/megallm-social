export interface Provider {
  slug: string;
  name: string;
  description: string;
  website: string;
  docsUrl: string;
  tier: "major" | "mid" | "emerging";
}

export const providers: Provider[] = [
  {
    slug: "openai",
    name: "OpenAI",
    description:
      "OpenAI pioneered the modern LLM era with the GPT series and remains the market leader in API adoption. Their product line spans from the ultra-cheap GPT-4o-mini to the frontier reasoning model o3, covering virtually every use case from chatbots to scientific research.",
    website: "https://openai.com",
    docsUrl: "https://platform.openai.com/docs",
    tier: "major",
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    description:
      "Anthropic builds the Claude family of models with a focus on safety, steerability, and long-context performance. Claude models are known for strong instruction following, nuanced writing, and a 200k-token context window that handles large documents natively.",
    website: "https://anthropic.com",
    docsUrl: "https://docs.anthropic.com",
    tier: "major",
  },
  {
    slug: "google",
    name: "Google",
    description:
      "Google's Gemini models leverage the company's massive compute infrastructure and multimodal research to offer industry-leading context windows up to 2 million tokens. The Gemini lineup spans from the ultra-cheap Flash tier to the reasoning-capable 2.5 Pro.",
    website: "https://deepmind.google",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    tier: "major",
  },
  {
    slug: "meta",
    name: "Meta",
    description:
      "Meta's Llama models are the most widely deployed open-weight LLMs in the world. By releasing models from 8B to 405B parameters under permissive licenses, Meta has built an enormous ecosystem of fine-tuned variants, hosting providers, and community tooling.",
    website: "https://ai.meta.com",
    docsUrl: "https://llama.meta.com/docs/overview",
    tier: "major",
  },
  {
    slug: "mistral",
    name: "Mistral",
    description:
      "Mistral AI is a Paris-based lab that has rapidly established itself with both open-weight and commercial models. Their mixture-of-experts architecture powers efficient models like Mixtral, while dedicated products like Codestral target specific developer workflows.",
    website: "https://mistral.ai",
    docsUrl: "https://docs.mistral.ai",
    tier: "mid",
  },
  {
    slug: "cohere",
    name: "Cohere",
    description:
      "Cohere focuses on enterprise NLP with models purpose-built for retrieval-augmented generation, semantic search, and text classification. Their Command R family features native citation generation that traces outputs back to source documents.",
    website: "https://cohere.com",
    docsUrl: "https://docs.cohere.com",
    tier: "mid",
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    description:
      "DeepSeek is a Chinese AI lab that disrupted the industry by training frontier-class models at a fraction of the typical cost. Their V3 and R1 models offer GPT-4o and o1-level performance respectively, with open weights and aggressive API pricing that undercut all major competitors.",
    website: "https://deepseek.com",
    docsUrl: "https://platform.deepseek.com/api-docs",
    tier: "emerging",
  },
  {
    slug: "alibaba",
    name: "Alibaba Cloud",
    description:
      "Alibaba Cloud develops the Qwen series of open-weight models, which lead the field in Chinese language understanding while remaining competitive on English benchmarks. The Qwen 2.5 family includes models from 0.5B to 72B parameters, serving a wide range of deployment scenarios.",
    website: "https://www.alibabacloud.com",
    docsUrl: "https://help.aliyun.com/zh/model-studio/developer-reference/qwen-api",
    tier: "emerging",
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    description:
      "Microsoft develops the Phi series of small language models that achieve outsized performance through synthetic data and curriculum learning techniques. The Phi models are designed for edge deployment and resource-constrained environments where larger models are impractical.",
    website: "https://azure.microsoft.com/en-us/products/ai-services",
    docsUrl: "https://azure.microsoft.com/en-us/products/phi",
    tier: "major",
  },
  {
    slug: "ai21",
    name: "AI21 Labs",
    description:
      "AI21 Labs builds the Jamba family of hybrid SSM-Transformer models that combine Mamba's efficient long-context processing with Transformer attention. Their enterprise focus emphasizes reliable structured output, document processing, and cost-efficient inference at scale.",
    website: "https://www.ai21.com",
    docsUrl: "https://docs.ai21.com",
    tier: "mid",
  },
  {
    slug: "databricks",
    name: "Databricks",
    description:
      "Databricks develops DBRX and other models optimized for data engineering and analytics workflows. Their Mosaic ML acquisition brought model training expertise that they integrate tightly with the Databricks Lakehouse platform.",
    website: "https://www.databricks.com",
    docsUrl: "https://docs.databricks.com/en/machine-learning/foundation-models/index.html",
    tier: "mid",
  },
];
