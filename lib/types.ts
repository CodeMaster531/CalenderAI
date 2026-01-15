export type TimeRange = {
  start: Date;
  end?: Date;
  allDay?: boolean;
  tz?: string;
};

export type EventSuggestion = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  time: TimeRange;
  labels?: string[];
  source?: string;
};

export type UploadResponse = {
  source: {
    filename: string;
    contentType: string;
    bytes: number;
    meta?: Record<string, any>;
  };
  suggestions: EventSuggestion[];
};
