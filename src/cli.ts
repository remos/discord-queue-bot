#!/usr/bin/env node

import {fromConfig} from './initialise';

try {
    fromConfig();
} catch(e) {
    console.error(e);
    process.exit(1);
}