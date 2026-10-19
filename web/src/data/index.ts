import { config } from '../config/env';
import { ApiDataSource } from './api/ApiDataSource';
import { DemoDataSource } from './demo/DemoDataSource';
import type { DataSource } from './source';

/** The one data source the whole site uses, picked by VITE_DATA_MODE. */
export const ds: DataSource = config.dataMode === 'api' ? new ApiDataSource() : new DemoDataSource();

export type { DataSource } from './source';
export * from './types';
