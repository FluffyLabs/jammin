import { Command } from "commander";
import * as p from "@clack/prompts";

export const testCommand = new Command("test")
  .description("run tests for your project")
  .argument("[pattern]", "test file pattern")
  .option("-w, --watch", "watch files and re-run tests on changes")
  .addHelpText("after", `
Examples:
  $ jammin test
  $ jammin test **/*-pattern.{test,spec}.{ts,js}
  $ jammin test /my-tests/*.ts --watch
`)
  .action(async (pattern, options) => {
    let tests = 5;
    if (pattern) {
      p.intro(`🏃 Running test ${pattern}...`);
      tests = 1;
    } else {
      p.intro("🏃 Running tests..");
    }

    for (let i = 0; i < tests; i++) {
      p.log.info(`Testing service ${i}...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (i === 3) {
        p.log.error(`Service ${i} failed!`);
      } else {
        p.log.success(`Service ${i} passed!`);
      }
    }

    if (options.watch) {
      p.note("👀 watching for changes");
    } else {
      p.outro("📊 Finished testing!")
    }
});
