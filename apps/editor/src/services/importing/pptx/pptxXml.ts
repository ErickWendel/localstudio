function parseXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) throw new Error(`PowerPoint XML could not be parsed: ${parserError.textContent ?? ''}`);
  return document;
}

function descendants(element: ParentNode, localName: string) {
  return Array.from(element.querySelectorAll('*')).filter((item) => item.localName === localName);
}

function firstDescendant(element: ParentNode, localName: string) {
  return descendants(element, localName)[0];
}

function childElements(element: ParentNode, localName?: string) {
  return Array.from(element.children).filter((item) => !localName || item.localName === localName);
}

function getAttr(element: Element | undefined, name: string) {
  if (!element) return undefined;
  return element.getAttribute(name) ?? element.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', name);
}

function getRelationshipAttr(element: Element | undefined, name: string) {
  if (!element) return undefined;
  return element.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', name) ??
    element.getAttribute(`r:${name}`);
}

function textContent(element: ParentNode, localName: string) {
  return descendants(element, localName)
    .map((item) => item.textContent ?? '')
    .join('');
}

export const pptxXml = {
  childElements,
  descendants,
  firstDescendant,
  getAttr,
  getRelationshipAttr,
  parseXml,
  textContent,
};
