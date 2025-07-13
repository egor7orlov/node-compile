import { Command } from 'commander';
import * as fs from 'node:fs';
import * as fsAsync from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const program = new Command()
  .name('node-compile')
  .description(
    'Literally just an execution of commands from Node.js docs on SEA',
  )
  .version('1.0.0')
  .argument('<in>')
  .argument('[out]');

const TEMP_FOLDER = '/tmp/node-compile';
const SEA_CFG_FILENAME = 'sea-config.json';
const BLOB_FILENAME = 'a.blob';

const IS_MACOS = process.platform === 'darwin';

async function main() {
  try {
    program.parse();

    const nodePath = (await execAsync('command -v node')).stdout.trim();
    const inputJsPath = program.args[0];
    const outExecPath =
      program.args[1] || path.basename(inputJsPath, path.extname(inputJsPath));

    console.log(
      `Node.js binary path: ${path.resolve(nodePath)}
Input JavaScript file: ${path.resolve(inputJsPath)}
Output executable: ${path.resolve(outExecPath)}`,
    );

    if (!fs.existsSync(TEMP_FOLDER)) {
      await fsAsync.mkdir(TEMP_FOLDER);
    }

    const seaCfgPath = path.join(TEMP_FOLDER, SEA_CFG_FILENAME);
    const blobPath = path.join(TEMP_FOLDER, BLOB_FILENAME);
    const seaCfg = {
      main: inputJsPath,
      output: blobPath,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: true,
    };

    await fsAsync.writeFile(seaCfgPath, JSON.stringify(seaCfg));

    await execAsync(`node --experimental-sea-config ${seaCfgPath}`);
    await execAsync(`cp ${nodePath} ${outExecPath}`);

    if (IS_MACOS) {
      await execAsync(`codesign --remove-signature ${outExecPath}`);
    }

    let postjectCmdStr = `npx postject ${outExecPath} NODE_SEA_BLOB ${blobPath} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;
    if (IS_MACOS) {
      postjectCmdStr += ' --macho-segment-name NODE_SEA';
    }
    await execAsync(postjectCmdStr);

    if (IS_MACOS) {
      await execAsync(`codesign --sign - ${outExecPath}`);
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await fsAsync.rm(TEMP_FOLDER, { force: true, recursive: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
