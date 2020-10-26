import { normalize } from 'path';

import { setAppRoot } from '@util/meta';
import { withoutExtension, handleBuiltin } from '@util/path';

describe(withoutExtension, () => {
  it('handles bare filenames', () => {
    expect(withoutExtension('asdf.exe')).toBe('asdf');
  });

  it('handles paths', () => {
    expect(withoutExtension('/qwer/zxcv/asdf.exe')).toBe('asdf');
  });
});

describe(handleBuiltin, () => {
  setAppRoot('/root/root');

  it('handles bare linux filenames', () => {
    expect(handleBuiltin('some/path', '$builtin/asdf'))
      .toBe(normalize('/root/some/path/asdf'));
  });

  it('handles linux paths', () => {
    expect(handleBuiltin('some/path', '/foo/bar/$builtin/asdf'))
      .toBe(normalize('/root/some/path/asdf'));
  });

  it('handles bare windows filenames', () => {
    expect(handleBuiltin('some/path', '$builtin\\asdf'))
      .toBe(normalize('/root/some/path/asdf'));
  });

  it('handles windows paths', () => {
    expect(handleBuiltin('some/path', 'C:\\foo\\bar\\$builtin\\asdf'))
      .toBe(normalize('/root/some/path/asdf'));
  });
});
