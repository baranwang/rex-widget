import { WidgetAdaptor } from "@rexnow/libs/widget-adaptor";
import { rs } from "@rstest/core";

rs.stubGlobal("Widget", WidgetAdaptor);
for (const name of ["WidgetMetadata", "searchDanmu", "getDetail", "getComments"]) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, {
      value: undefined,
      writable: true,
      configurable: true,
    });
  }
}
// WidgetAdaptor.storage.clear();
