import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InfoPopover } from '@/components/ui/info-popover';
import { cn, formatDifficulty, formatHashrate, formatUptime } from '@/lib/utils';
import type { MinerTelemetry, MinerTelemetryStatus, Sv2ClientKind } from '@/types/api';

export type ChannelType = 'sv1' | 'sv2_standard' | 'sv2_extended';
export type WorkerHashrateSource = 'miner_telemetry' | 'estimated' | 'unavailable';

export interface DownstreamWorkerRow {
  connection_id: number;
  channel_id: number | null;
  channel_type: ChannelType;
  user_identity: string;
  management_ip?: string | null;
  miner_telemetry_status?: MinerTelemetryStatus | null;
  miner_telemetry?: MinerTelemetry | null;
  client_kind?: Sv2ClientKind | null;
  estimated_hashrate: number | null;
  hashrate_source: WorkerHashrateSource;
  best_diff: number | null;
}

export type DownstreamWorkerSortKey =
  | 'connection_id'
  | 'channel_id'
  | 'channel_type'
  | 'user_identity'
  | 'estimated_hashrate'
  | 'best_diff';

interface DownstreamWorkerTableProps {
  workers: DownstreamWorkerRow[];
  isLoading?: boolean;
  sortKey: DownstreamWorkerSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: DownstreamWorkerSortKey) => void;
  showBestDiff?: boolean;
}

const TABLE_CONTAINER_CLASS_NAME = 'glass-table shadow-sm';

function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: DownstreamWorkerSortKey;
  sortKey: DownstreamWorkerSortKey;
  sortDir: 'asc' | 'desc';
}) {
  if (column !== sortKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return sortDir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5" />
    : <ChevronDown className="h-3.5 w-3.5" />;
}

function getChannelTypeLabel(channelType: ChannelType) {
  switch (channelType) {
    case 'sv1':
      return 'SV1';
    case 'sv2_standard':
      return 'SV2 Standard';
    case 'sv2_extended':
      return 'SV2 Extended';
  }
}

function getChannelTypeClassName(channelType: ChannelType) {
  switch (channelType) {
    case 'sv1':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'sv2_standard':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'sv2_extended':
      return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
  }
}

function formatWorkerHashrate(worker: DownstreamWorkerRow) {
  if (worker.estimated_hashrate === null) return '-';
  const prefix = worker.hashrate_source === 'estimated' ? '~' : '';
  return `${prefix}${formatHashrate(worker.estimated_hashrate)}`;
}

function getTelemetryStatusLabel(status: MinerTelemetryStatus | null | undefined) {
  switch (status) {
    case 'matched':
      return 'Telemetry matched';
    case 'unmatched':
      return 'Telemetry unmatched';
    case 'duplicate_worker_name':
      return 'Duplicate worker name';
    case 'fetch_failed':
      return 'Telemetry fetch failed';
    default:
      return null;
  }
}

function formatTelemetryValue(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits,
  });
}

function isTelemetryNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getTelemetryText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function getMinerLabel(telemetry: MinerTelemetry | null | undefined) {
  if (!telemetry) return '-';
  return [getTelemetryText(telemetry.make), getTelemetryText(telemetry.model)]
    .filter(Boolean)
    .join(' ') || '-';
}

function getFirmwareLabel(telemetry: MinerTelemetry | null | undefined) {
  return getTelemetryText(telemetry?.firmware_version) || '-';
}

function getMiningStateLabel(telemetry: MinerTelemetry | null | undefined) {
  if (!telemetry || telemetry.is_mining === null || telemetry.is_mining === undefined) {
    return '-';
  }
  return telemetry.is_mining ? 'Mining' : 'Idle';
}

function formatTelemetryMetric(value: number | null | undefined, unit: string) {
  return isTelemetryNumber(value) ? `${formatTelemetryValue(value)} ${unit}` : '-';
}

function getUptimeLabel(telemetry: MinerTelemetry | null | undefined) {
  if (!isTelemetryNumber(telemetry?.uptime_secs)) return '-';
  return formatUptime(Math.max(0, Math.round(telemetry.uptime_secs)));
}

function getTelemetryStatusClassName(status: MinerTelemetryStatus | null | undefined) {
  switch (status) {
    case 'matched':
      return 'text-emerald-500';
    case 'unmatched':
    case 'duplicate_worker_name':
    case 'fetch_failed':
      return 'text-amber-500';
    default:
      return 'text-muted-foreground';
  }
}

function getMiningStateClassName(telemetry: MinerTelemetry | null | undefined) {
  if (telemetry?.is_mining !== null && telemetry?.is_mining !== undefined) {
    return telemetry.is_mining ? 'text-emerald-500' : 'text-muted-foreground';
  }
  return 'text-muted-foreground';
}

/**
 * Shared worker table for downstream connections across dashboard modes.
 */
export function DownstreamWorkerTable({
  workers,
  isLoading,
  sortKey,
  sortDir,
  onSort,
  showBestDiff = true,
}: DownstreamWorkerTableProps) {
  if (isLoading) {
    return (
      <div className={TABLE_CONTAINER_CLASS_NAME}>
        <div className="p-8 text-center text-muted-foreground">
          Loading workers...
        </div>
      </div>
    );
  }

  return (
    <div className={TABLE_CONTAINER_CLASS_NAME}>
      {workers.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No workers connected
        </div>
      ) : (
        <Table className="min-w-[1680px]">
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[132px] cursor-pointer select-none whitespace-nowrap" onClick={() => onSort('connection_id')}>
                <span className="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors">
                  Connection Id
                  <SortIcon column="connection_id" sortKey={sortKey} sortDir={sortDir} />
                  <InfoPopover>
                    Worker channels with the same connection ID belong to the same downstream
                    connection.
                  </InfoPopover>
                </span>
              </TableHead>
              <TableHead className="w-[120px] cursor-pointer select-none whitespace-nowrap" onClick={() => onSort('channel_id')}>
                <span className="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors">
                  Channel Id <SortIcon column="channel_id" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </TableHead>
              <TableHead className="w-[220px] cursor-pointer select-none whitespace-nowrap" onClick={() => onSort('channel_type')}>
                <span className="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors">
                  Channel Type <SortIcon column="channel_type" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => onSort('user_identity')}>
                <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                  User Identity <SortIcon column="user_identity" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </TableHead>
              <TableHead className="whitespace-nowrap">Management IP</TableHead>
              <TableHead className="whitespace-nowrap">Telemetry</TableHead>
              <TableHead className="whitespace-nowrap">Miner</TableHead>
              <TableHead className="whitespace-nowrap">Firmware</TableHead>
              <TableHead className="whitespace-nowrap">State</TableHead>
              <TableHead className="text-right whitespace-nowrap">Temp</TableHead>
              <TableHead className="text-right whitespace-nowrap">Power</TableHead>
              <TableHead className="text-right whitespace-nowrap">Efficiency</TableHead>
              <TableHead className="text-right whitespace-nowrap">Uptime</TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => onSort('estimated_hashrate')}>
                <span className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                  Hashrate
                  <SortIcon column="estimated_hashrate" sortKey={sortKey} sortDir={sortDir} />
                  <InfoPopover>
                    Uses miner-reported telemetry when available. Otherwise falls back to the
                    proxy's vardiff estimate from submitted shares.
                  </InfoPopover>
                </span>
              </TableHead>
              {showBestDiff && (
                <TableHead
                  className="text-right cursor-pointer select-none whitespace-nowrap"
                  onClick={() => onSort('best_diff')}
                >
                  <span className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Best Diff <SortIcon column="best_diff" sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.map((worker) => (
              <TableRow key={`${worker.connection_id}-${worker.channel_type}-${worker.channel_id ?? 'na'}-${worker.user_identity}`} className="hover:bg-muted/20 group">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {worker.connection_id}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {worker.channel_id ?? '-'}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      getChannelTypeClassName(worker.channel_type)
                    )}
                  >
                    {getChannelTypeLabel(worker.channel_type)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {worker.user_identity || '-'}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {worker.management_ip || '-'}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-xs whitespace-nowrap',
                    getTelemetryStatusClassName(worker.miner_telemetry_status)
                  )}
                >
                  {getTelemetryStatusLabel(worker.miner_telemetry_status) || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {getMinerLabel(worker.miner_telemetry)}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {getFirmwareLabel(worker.miner_telemetry)}
                </TableCell>
                <TableCell
                  className={cn(
                    'whitespace-nowrap',
                    getMiningStateClassName(worker.miner_telemetry)
                  )}
                >
                  {getMiningStateLabel(worker.miner_telemetry)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">
                  {formatTelemetryMetric(worker.miner_telemetry?.average_temperature_c, 'C')}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">
                  {formatTelemetryMetric(worker.miner_telemetry?.power_consumption_w, 'W')}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">
                  {formatTelemetryMetric(worker.miner_telemetry?.efficiency_j_per_th, 'J/TH')}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">
                  {getUptimeLabel(worker.miner_telemetry)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium whitespace-nowrap">
                  {formatWorkerHashrate(worker)}
                </TableCell>
                {showBestDiff && (
                  <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">
                    {worker.best_diff !== null && worker.best_diff > 0 ? formatDifficulty(worker.best_diff) : '-'}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
