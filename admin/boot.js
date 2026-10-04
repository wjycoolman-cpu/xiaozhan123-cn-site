import cloudbase from './vendor/cloudbase-3.10.1.esm.js';
import {adminConfig} from './config.js';
import {mountAdmin} from './admin.js';
mountAdmin(cloudbase, adminConfig);
