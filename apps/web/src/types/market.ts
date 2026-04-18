/**
 * OracleEyes market data types
 */

export type OhlcBar = {
  time: number; // Unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
