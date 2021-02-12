import open from 'open';

export default async function start({ port }: { port: number }): Promise<void> {
  open(`http://localhost:${port}`, { wait: false }).then(cp => cp.unref());
}
