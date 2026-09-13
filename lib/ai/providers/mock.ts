import type { z } from "zod";
import { parseStructured } from "./shared";
import type { AiMessage, AiProvider, AiRequestOptions } from "./types";

export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly model: string;
  constructor(model = "talkingston-test") { this.model = model; }

  async generateText(messages: AiMessage[], options?: Partial<AiRequestOptions>): Promise<string> {
    void options;
    const latest = messages.findLast((message) => message.role === "user")?.content.trim();
    return latest ? `I hear you. Let&apos;s take that one step at a time: ${latest}` : "I&apos;m here with you. What would you like to explore?";
  }

  async *streamText(messages: AiMessage[], options?: Partial<AiRequestOptions>): AsyncIterable<string> {
    yield await this.generateText(messages, options);
  }

  async generateStructured<T>(messages: AiMessage[], schema: z.ZodType<T>): Promise<T> {
    const text = await this.generateText(messages);
    return parseStructured(`{"content":${JSON.stringify(text)}}`, schema, this.name);
  }
}
