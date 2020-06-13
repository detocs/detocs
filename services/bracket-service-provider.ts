import memoize from "micro-memoize";
import BracketService from './bracket-service';

export default class BracketServiceProvider {
  private readonly suppliers = new Map<string, () => BracketService>();
  public register(name: string, supplier: () => BracketService): void {
    this.suppliers.set(name, memoize(supplier));
  }
  public get(name: string): BracketService {
    const supplier = this.suppliers.get(name);
    if (!supplier) {
      throw new Error(`No bracket service available for "${name}"`);
    }
    return supplier();
  }
}
