import { join } from 'path';

import {
  getSingleVideoTemplate,
  getSingleVideoTitleTemplate,
  getPerSetTemplate,
  getPerSetTitleTemplate,
  TEST_DATA,
} from '@upload/templating';
import { setAppRoot } from '@util/meta';

setAppRoot(join(__dirname, '../../assets/foo'));

describe(getSingleVideoTemplate, () => {
  it('can render test data', async () => {
    const template = await getSingleVideoTemplate();
    template(TEST_DATA);
  });
});

describe(getSingleVideoTitleTemplate, () => {
  it('can render test data', async () => {
    const template = await getSingleVideoTitleTemplate();
    template(TEST_DATA);
  });
});

describe(getPerSetTemplate, () => {
  it('can render test data', async () => {
    const template = await getPerSetTemplate();
    template(TEST_DATA);
  });
});

describe(getPerSetTitleTemplate, () => {
  it('can render test data', async () => {
    const template = await getPerSetTitleTemplate();
    template(TEST_DATA);
  });
});
