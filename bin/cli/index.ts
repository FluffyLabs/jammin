#!/usr/bin/env bun

import { program } from "commander";
import { version } from "./package.json" with { type: "json" };
import { buildCommand } from "./src/commands/build-command";
import { deployCommand } from "./src/commands/deploy-command";
import { newCommand } from "./src/commands/new-command";
import { testCommand } from "./src/commands/test-command";

program
  .name("jammin")
  .description("JAM development tooling. Create, build, deploy and test your multi-service projects.")
  .version(version);

program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => `${cmd.name()}·${cmd.usage()}`,
});

program.addCommand(newCommand);
program.addCommand(buildCommand);
program.addCommand(testCommand);
program.addCommand(deployCommand);

// TODO: [MaSo] Display actual examples
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
  console.error(`❌ Error: ${err}`);
  process.exit(1);
}
