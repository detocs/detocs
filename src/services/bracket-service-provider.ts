import memoize from "micro-memoize";
import BracketService from './bracket-service';

export interface ParsedIds {
  tournamentId: string;
  phaseId?: string;
}
export type IdParser = (url: string) => ParsedIds | null;
export interface ParsedUrl {
  serviceName: string;
  parsedIds: ParsedIds;
}

export default class BracketServiceProvider {
  private readonly suppliers = new Map<string, () => BracketService>();
  private readonly parsers: { name: string; parser: IdParser }[] = [];

  public register(
    name: string,
    tournamentUrlParser: IdParser,
    supplier: () => BracketService
  ): void {
    this.suppliers.set(name, memoize(supplier));
    this.parsers.push({ name, parser: tournamentUrlParser });
  }

  public get(name: string): BracketService {
    const supplier = this.suppliers.get(name);
    if (!supplier) {
      throw new Error(`No bracket service available for "${name}"`);
    }
    return supplier();
  }

  public parse(url: string): ParsedUrl | null {
    for (const { name: serviceName, parser } of this.parsers) {
      const parsedIds = parser(url);
      if (parsedIds) {
        return { serviceName, parsedIds };
      }
    }
    return null;
  }
}
