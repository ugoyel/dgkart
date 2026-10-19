import { ValueTransformer } from 'typeorm';

/** Postgres returns NUMERIC as string; expose it as a JS number. */
export const numeric: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v === null || v === undefined ? v : parseFloat(v)),
};
