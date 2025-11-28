import { Command } from "commander";
import * as p from "@clack/prompts";

// TODO: [MaSo] dummy command
export const buildCommand = new Command("build")
  .description("build your multi-service project")
  .option("-s, --service <name>", "build specific service only")
  .action(async (options) => {
    const s = p.spinner();
    if (options.service) {
      s.start(`🔨 Building service ${options.service}...`);
    } else {
      s.start("🔨 Building project...");
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    s.stop("✅ Build completed successfully!");
});


