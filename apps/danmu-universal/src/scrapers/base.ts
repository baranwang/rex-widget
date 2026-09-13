import { BaseScraper as PackageBaseScraper } from "@rexnow/scraper-kit";
import { Fetch } from "../libs/fetch";

export type {
  BaseScraperRuntime,
  ProviderCommentItem,
  ProviderDramaInfo,
  ProviderEpisodeInfo,
  ProviderSegmentInfo,
  ScraperFetch,
  SearchDanmuParams,
} from "@rexnow/scraper-kit";
export { CommentMode, providerCommentItemSchema } from "@rexnow/scraper-kit";

export abstract class BaseScraper<
  IDType extends import("@rexnow/scraper-kit").z.ZodType = import("@rexnow/scraper-kit").z.ZodType,
> extends PackageBaseScraper<IDType> {
  constructor() {
    super({ fetch: new Fetch() });
  }
}
