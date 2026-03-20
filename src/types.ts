export interface CapturedRequest {
  id: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  queryParams: Record<string, string>;
  timestamp: number;
  contentType: string | null;
  ip: string | null;
  path: string;
  size: number;
}

export interface Session {
  id: string;
  createdAt: number;
  requests: CapturedRequest[];
  listeners: Set<(data: CapturedRequest) => void>;
}
