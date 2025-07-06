#!/usr/bin/env node

/**
 * cgwt - Quick session switcher for Claude GWT
 * CLI entry point
 */

import { createProgram } from './cgwt-program.js';

// Create and parse the program
const program = createProgram();
program.parse(process.argv);
