import Handlebars from 'handlebars';

export function setDefaultEscapingFunction(
  hb: typeof Handlebars,
  escapingFunction: (val: unknown) => unknown,
): void {
  hb.escapeExpression = function(value: unknown) {
    if (value == null) {
      return '';
    }
    if (isSafeString(value)) {
      return value.toHTML();
    }
    return '' + escapingFunction(value);
  };
}

function isSafeString(value: unknown): value is Handlebars.SafeString {
  return value && typeof value === 'object' && 'toHTML' in value;
}
