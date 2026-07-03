#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { openPickerArgs } from '../lib/pane.js';

const herdr = process.env.HERDR_BIN_PATH || 'herdr';
const res = spawnSync(herdr, openPickerArgs(process.env.HERDR_PLUGIN_ID), { stdio: 'inherit' });
process.exit(res.status ?? 1);
