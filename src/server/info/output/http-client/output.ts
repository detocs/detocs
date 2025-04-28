import { getLogger } from '@util/logger';

import FormData from 'form-data';

import { HttpClientOutputConfig, OutputTemplateConfig } from '@util/configuration/config';
import State from '@server/info/state';
import Output from '@server/info/output/output';
import { OutputTemplate, parseTemplateFile } from '@server/info/output/templates';
import { Ok, ResultAsync } from 'neverthrow';
import { checkResponseStatus } from '@util/ajax';

const logger = getLogger('output/http-client');

export default class HttpClientOutput implements Output {
  private readonly url: string;
  private readonly method: string;
  private readonly headers: Record<string, string>;
  private readonly templateFiles: OutputTemplateConfig[];
  private readonly bodyFn: (data: string) => BodyInit;
  private templates: OutputTemplate[] = [];
  private currentData: string[] = [];

  public constructor({ templates, url, method, headers, formDataName }: HttpClientOutputConfig) {
    this.templateFiles = templates;
    this.url = url;
    this.method = method ?? 'GET';
    this.headers = headers ?? {};
    this.bodyFn = data => {
      const formData = new FormData();
      formData.append(formDataName, data);
      return formData as unknown as BodyInit;
    };
  }

  public async init(initState: State): Promise<void> {
    this.templates = await Promise.all(this.templateFiles.map(parseTemplateFile));

    logger.info(`Initializing HTTP client output adapter with address ${this.url}`);
    this.update(initState);
  }

  public update(state: State): void {
    const files = this.templates.map(t => t.render(state));
    files.forEach(data => data.match(
      () => {/* noop */},
      logger.error,
    ));
    this.currentData = files.filter(data => data.isOk())
      .map(data => (data as Ok<string, Error>).value);
    logger.debug(`Sending update:\n`, this.currentData.join('\n'));
    this.currentData.forEach(data => this.sendData(data));
  }

  private async sendData(data: string): Promise<void> {
    return ResultAsync.fromPromise(
      fetch(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.bodyFn(data),
      })
        .then(checkResponseStatus)
        .then(resp => resp.text().then(text => [resp.status, text])),
      e => e as Error,
    ).match(
      ([status, text]) => logger.debug(`Request sent successfully with status ${status}: ${text}`),
      err => logger.error(`Error sending request:`, err),
    );
  }
}
