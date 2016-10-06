#!/usr/bin/env node

import express from 'express';
import favicon from 'serve-favicon';
import program from 'commander';
import path from 'path';
import fs from 'fs';
import storybook from './middleware';
import packageJson from '../../package.json';
import { parseList, getEnvConfig } from './utils';
import { track, dontTrack } from './track_usage';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const logger = console;

program
  .version(packageJson.version)
  .option('-p, --port [number]', 'Port to run Storybook (Required)', parseInt)
  .option('-h, --host [string]', 'Host to run Storybook')
  .option('-s, --static-dir <dir-names>', 'Directory where to load static files from')
  .option('-c, --config-dir [dir-name]', 'Directory where to load Storybook configurations from')
  .option('--dont-track', 'Do not send anonymous usage stats.')
  .parse(process.argv);

// The key is the field created in `program` variable for
// each command line argument. Value is the env variable.
getEnvConfig(program, {
  port: 'SBCONFIG_PORT',
  host: 'SBCONFIG_HOSTNAME',
  staticDir: 'SBCONFIG_STATIC_DIR',
  configDir: 'SBCONFIG_CONFIG_DIR',
  dontTrack: 'SBCONFIG_DO_NOT_TRACK',
});

if (program.dontTrack) {
  dontTrack();
}

if (!program.port) {
  logger.error('Error: port to run Storybook is required!\n');
  program.help();
  process.exit(-1);
}

// Used with `app.listen` below
const listenAddr = [program.port];

if (program.host) {
  listenAddr.push(program.host);
}

const app = express();
app.use(favicon(path.resolve(__dirname, 'public/favicon.ico')));

if (program.staticDir) {
  program.staticDir = parseList(program.staticDir);
  program.staticDir.forEach((dir) => {
    const staticPath = path.resolve(dir);
    if (!fs.existsSync(staticPath)) {
      logger.error(`Error: no such directory to load static files: ${staticPath}`);
      process.exit(-1);
    }
    logger.log(`=> Loading static files from: ${staticPath} .`);
    app.use(express.static(staticPath, { index: false }));
  });
}

// Build the webpack configuration using the `baseConfig`
// custom `.babelrc` file and `webpack.config.js` files
const configDir = program.configDir || './.storybook';

// NOTE changes to env should be done before calling `getBaseConfig`
// `getBaseConfig` function which is called inside the middleware
app.use(storybook(configDir));

app.listen(...listenAddr, function (error) {
  if (error) {
    throw error;
  } else {
    const address = `http://${program.host || 'localhost'}:${program.port}/`;
    logger.info(`\nReact Storybook started on => ${address}\n`);
    track();
  }
});
