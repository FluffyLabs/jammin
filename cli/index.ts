import { program } from "commander";
import { version } from "./package.json";
import { newCommand } from "./src/newCommand";
import { buildCommand } from "./src/buildCommand";

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

// TODO: [MaSo] Display accual examples
program.on("--help", () => {
  console.log("");
  console.log("Examples:");
  console.log("  $ jammin new [options]");
  console.log("  $ jammin build [options]");
  console.log("  $ jammin test [options]");
  console.log("  $ jammin deploy [options]");
  console.log("");
  console.log("For more information, visit: https://fluffylabs.dev/jammin/");
});

try {
  await program.parseAsync(process.argv);
} catch (err: any) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
