/**
 * Fetch GitHub repo into a target directory
 *
 * @param repo - Repository in format "owner/repo"
 * @param dest - Destination folder path
 */
export async function fetchRepo(repo: string, dest: string): Promise<void> {
  const result = await Bun.$`bun create --no-install ${repo} ${dest}`.quiet();
  if (result.exitCode !== 0) {
    throw Error(`Failed to fetch ${repo}: ${result.stderr}`);
  }
}
