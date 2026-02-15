export interface IPrintJob {
  id: number;
  registered: string;
  spool_id: number;
  name: string;
  weight_used: number;
  started_at?: string;
  completed_at?: string;
  cost?: number;
  revenue?: number;
  notes?: string;
  external_reference?: string;
}
