export function createMockLocator(initialValue: string) {
  let currentValue = initialValue;
  const calls: string[] = [];
  const attributes: Record<string, string> = {};

  return {
    inputValue: async () => {
      calls.push("inputValue");
      return currentValue;
    },
    innerText: async () => {
      calls.push("innerText");
      return currentValue;
    },
    fill: async (val: string) => {
      calls.push(`fill(${val})`);
      currentValue = val;
    },
    pressSequentially: async (val: string) => {
      calls.push(`pressSequentially(${val})`);
      currentValue = val;
    },
    click: async () => {
      calls.push("click");
    },
    getAttribute: async (name: string) => {
      calls.push(`getAttribute(${name})`);
      return attributes[name] || null;
    },
    selectText: async () => {
      calls.push("selectText");
    },
    _setAttributes: (attrs: Record<string, string>) => {
      Object.assign(attributes, attrs);
    },
    _getCalls: () => calls,
  };
}
