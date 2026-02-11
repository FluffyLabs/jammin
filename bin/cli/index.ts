#!/usr/bin/env bun

import { program } from "commander";
import { version } from "./package.json" with { type: "json" };
import { buildCommand } from "./src/commands/build-command";
import { createCommand } from "./src/commands/create-command";
import { deployCommand } from "./src/commands/deploy-command";
import { startCommand } from "./src/commands/start-command";
import { testCommand } from "./src/commands/test-command";

program
  .name("jammin")
  .description("JAM development tooling. Create, build, deploy and test your multi-service projects.")
  .version(version);

program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => `${cmd.name()}·${cmd.usage()}`,
});

// Adding commands
program.addCommand(createCommand);
program.addCommand(buildCommand);
program.addCommand(testCommand);
program.addCommand(deployCommand);
program.addCommand(startCommand);

// TODO: [MaSo] Display accual examples
program.addHelpText(
  "after",
  `
Examples:
  $ jammin new [options]
  $ jammin build [options]
  $ jammin test [options]
  $ jammin deploy [options]

For more information, visit: https://fluffylabs.dev/jammin/`,
);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err instanceof Error) {
    console.error(`❌ Error: ${err.name}: ${err.message}`);
    if ("filePath" in err && err.filePath) {
      console.error(`   File: ${err.filePath}`);
    }
    if ("output" in err && err.output) {
      console.error(`   Output: ${err.output}`);
    }
  } else {
    console.error(`❌ Error: ${err}`);
  }
  process.exit(1);
}
