"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OhlcBar } from "@/types/market";

type Props = {
  bars: OhlcBar[];
  maxRows?: number;
};

export function OhlcTable({ bars, maxRows = 50 }: Props) {
  const slice = bars.slice(-maxRows).reverse();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Time (UTC)</TableHead>
            <TableHead className="text-right">Open</TableHead>
            <TableHead className="text-right">High</TableHead>
            <TableHead className="text-right">Low</TableHead>
            <TableHead className="text-right">Close</TableHead>
            <TableHead className="text-right">Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((b) => (
            <TableRow key={b.time}>
              <TableCell className="font-mono text-sm">
                {new Date(b.time * 1000).toISOString()}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">{b.open.toFixed(5)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{b.high.toFixed(5)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{b.low.toFixed(5)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{b.close.toFixed(5)}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {b.volume !== undefined ? b.volume : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {bars.length > maxRows && (
        <p className="text-muted-foreground border-t px-3 py-2 text-sm">
          Showing last {maxRows} of {bars.length} bars
        </p>
      )}
    </div>
  );
}
