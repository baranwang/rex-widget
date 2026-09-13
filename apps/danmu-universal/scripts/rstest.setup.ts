import { WidgetAdaptor } from "@rexnow/libs/widget-adaptor";
import { rs } from "@rstest/core";

rs.stubGlobal("Widget", WidgetAdaptor);
// WidgetAdaptor.storage.clear();
