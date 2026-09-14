import { dataSyncEventSchema, type DataSyncEvent } from "../../shared/data-sync";

export function subscribeDataChanges(
  receive: (event: DataSyncEvent) => void,
  disconnected: () => void
): () => void {
  const stream = new EventSource("/api/data-events");
  stream.onmessage = (message) => {
    try {
      const result = dataSyncEventSchema.safeParse(JSON.parse(String(message.data)));
      if (result.success) receive(result.data);
    } catch {
      disconnected();
    }
  };
  stream.onerror = disconnected;
  return () => stream.close();
}
