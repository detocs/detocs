import memoize from "micro-memoize";
import BracketService from './bracket-service';

type IdParser = (url: string) => string | null;

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

  public parse(url: string): { serviceName: string, serviceId: string } | null {
    for (const { name: serviceName, parser } of this.parsers) {
      const serviceId = parser(url);
      if (serviceId) {
        return { serviceName, serviceId };
      }
    }
    return null;
  }
}
