import { initializeFetchAdapter, initializeFetchStorageAdapter } from "@rexnow/libs-fetch";
import { storage } from "@rexnow/libs-storage";

initializeFetchAdapter({
  get: Widget.http.get.bind(Widget.http),
  post: Widget.http.post.bind(Widget.http),
});

initializeFetchStorageAdapter(storage);

export * from "@rexnow/libs-fetch";
