import { program } from "commander";
import { version } from "./package.json";
import { newCommand } from "./src/commands/newCommand";
import { buildCommand } from "./src/commands/buildCommand";
import { testCommand } from "./src/commands/testCommand";
import { deployCommand } from "./src/commands/deployCommand";

program
  .name("jammin")
  .description("JAM development tooling. Create, build, deploy and test your multi-service projects.")
  .version(version);

program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage(),
});

// Adding commands
program.addCommand(newCommand);
program.addCommand(buildCommand);
program.addCommand(testCommand);
program.addCommand(deployCommand);

// TODO: [MaSo] Display accual examples
program.addHelpText("after", `
Examples:
  $ jammin new [options]
  $ jammin build [options]
  $ jammin test [options]
  $ jammin deploy [options]

For more information, visit: https://fluffylabs.dev/jammin/`
);

try {
  await program.parseAsync(process.argv);
} catch (err: any) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
