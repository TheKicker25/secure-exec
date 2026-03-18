/**
 * Code Mode with Secure Exec
 *
 * Same pattern as @cloudflare/codemode, but using Secure Exec as the sandbox
 * instead of Cloudflare Workers. The LLM writes code that calls tools via
 * `codemode.*`, executed safely in a V8 isolate.
 *
 * See: https://blog.cloudflare.com/code-mode/
 */
import { generateText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { SecureExecExecutor } from "./executor.js";

// 1. Define your tools
const tools = {
  getWeather: tool({
    description:
      "Get current weather for a city. Returns { temp_f: number, condition: string, humidity: number }.",
    inputSchema: z.object({
      city: z.string().describe("City name"),
    }),
    execute: async ({ city }) => {
      const data: Record<
        string,
        { temp_f: number; condition: string; humidity: number }
      > = {
        "San Francisco": { temp_f: 62, condition: "Foggy", humidity: 78 },
        "New York": { temp_f: 84, condition: "Sunny", humidity: 55 },
        London: { temp_f: 58, condition: "Rainy", humidity: 88 },
        Tokyo: { temp_f: 91, condition: "Humid", humidity: 72 },
      };
      return data[city] ?? { temp_f: 70, condition: "Clear", humidity: 50 };
    },
  }),
  calculate: tool({
    description:
      "Evaluate a math expression. Returns { expression: string, result: number }.",
    inputSchema: z.object({
      expression: z
        .string()
        .describe("Math expression (e.g. '(72 - 58) * 1.8')"),
    }),
    execute: async ({ expression }) => {
      const result = new Function(`return (${expression})`)();
      return { expression, result };
    },
  }),
};

// 2. Create the Secure Exec executor (replaces DynamicWorkerExecutor)
const executor = new SecureExecExecutor({
  memoryLimit: 64,
  cpuTimeLimitMs: 10_000,
});

// 3. Build the tool description with generated types
const toolEntries = Object.entries(tools)
  .map(([name, t]) => `  /** ${t.description} */\n  ${name}: (input) => Promise<unknown>;`)
  .join("\n");
const codeToolDescription = `Execute JavaScript code that calls the available tools.
Write an async arrow function that uses the \`codemode\` API and returns the result.
Use plain JavaScript (no TypeScript). Chain multiple calls in a single function.

Available:
declare const codemode: {
${toolEntries}
}

Example:
async () => {
  const w = await codemode.getWeather({ city: "Tokyo" });
  return w;
}`;

// 4. Use it with generateText
async function main() {
  try {
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      prompt:
        "Compare the weather in San Francisco and Tokyo. Calculate the temperature difference in both Fahrenheit and Celsius.",
      stopWhen: stepCountIs(5),
      tools: {
        codemode: tool({
          description: codeToolDescription,
          inputSchema: z.object({
            code: z
              .string()
              .describe("JavaScript async arrow function to execute"),
          }),
          execute: async ({ code }) => {
            // Extract execute functions from AI SDK tools
            const fns: Record<
              string,
              (...args: unknown[]) => Promise<unknown>
            > = {};
            for (const [name, t] of Object.entries(tools)) {
              fns[name] = t.execute as (
                ...args: unknown[]
              ) => Promise<unknown>;
            }

            const result = await executor.execute(code, fns);
            if (result.error) throw new Error(result.error);
            return result;
          },
        }),
      },
    });

    console.log(text);
  } finally {
    executor.dispose();
  }
}

main().catch(console.error);
